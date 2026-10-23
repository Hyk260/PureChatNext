import { randomUUID } from 'node:crypto'
import { access, realpath, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import os from 'node:os'

import type { IPty } from '@lydell/node-pty'
import type {
  TerminalData,
  TerminalExit,
  TerminalOpenInput,
  TerminalSession,
  TerminalSizeInput,
} from '@/types/desktopTerminal'

import type { DesktopConfigService } from './DesktopConfigService'
import { loadTerminalRuntime } from './terminalRuntime'

const MAX_SESSIONS = 10
const MAX_INPUT_LENGTH = 64 * 1024
const OUTPUT_HIGH_WATER = 256 * 1024
const SYSTEM_ENV_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'PATH',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TMPDIR',
  'SSH_AUTH_SOCK',
]

export function terminalEnvironment(source: Partial<NodeJS.ProcessEnv>): Record<string, string> {
  const env: Record<string, string> = { TERM: 'xterm-256color', COLORTERM: 'truecolor' }
  for (const key of SYSTEM_ENV_KEYS) {
    if (source[key]) env[key] = source[key]
  }
  env.HOME ||= os.homedir()
  env.PATH ||= '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
  env.LANG ||= 'en_US.UTF-8'
  return env
}

function assertSize(cols: number, rows: number) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 1 || cols > 1000 || rows > 1000) {
    throw new Error('终端尺寸无效')
  }
}

async function directory(candidate: string) {
  const resolved = await realpath(candidate)
  if (!(await stat(resolved)).isDirectory()) throw new Error('工作目录不是文件夹')
  await access(resolved, constants.R_OK | constants.X_OK)
  return resolved
}

interface SessionState {
  info: TerminalSession
  owner: number
  pty: IPty
  ready: boolean
  pending: string
  paused: boolean
  timer?: ReturnType<typeof setTimeout>
}

interface TerminalOptions {
  config: Pick<DesktopConfigService, 'listProjects'>
  desktopPath: string
  resourcesPath?: string
  platform?: NodeJS.Platform
  spawn?: typeof import('@lydell/node-pty').spawn
  onData: (owner: number, event: TerminalData) => void
  onExit: (owner: number, event: TerminalExit) => void
}

export class TerminalService {
  private readonly sessions = new Map<string, SessionState>()
  private readonly opening = new Map<string, Promise<TerminalSession>>()
  private revision = 0

  constructor(private readonly options: TerminalOptions) {}

  open(owner: number, input: TerminalOpenInput): Promise<TerminalSession> {
    if ((this.options.platform ?? process.platform) !== 'darwin') return Promise.reject(new Error('终端仅支持 macOS'))
    if (
      !input ||
      (input.projectId !== null &&
        (typeof input.projectId !== 'string' || !input.projectId || input.projectId.length > 80))
    ) {
      return Promise.reject(new Error('项目标识无效'))
    }
    assertSize(input.cols, input.rows)
    const key = JSON.stringify([owner, input.projectId])
    const pending = this.opening.get(key)
    if (pending) return pending
    const revision = this.revision
    const request = this.create(owner, input, revision).finally(() => {
      if (this.opening.get(key) === request) this.opening.delete(key)
    })
    this.opening.set(key, request)
    return request
  }

  private async create(owner: number, input: TerminalOpenInput, revision: number): Promise<TerminalSession> {
    let cwd: string
    let warning: string | undefined
    if (input.projectId === null) {
      try {
        cwd = await directory(this.options.desktopPath)
      } catch {
        cwd = await directory(os.homedir())
        warning = '桌面目录不可用，已打开用户主目录'
      }
    } else {
      const project = (await this.options.config.listProjects()).find((item) => item.id === input.projectId)
      if (!project) throw new Error('本机项目不存在，请重新选择')
      try {
        cwd = await directory(project.rootPath)
      } catch {
        throw new Error('项目目录不存在或不可访问，请检查文件夹权限')
      }
    }
    if (revision !== this.revision) throw new Error('终端已关闭，请重新打开')
    const existing = [...this.sessions.values()].find((s) => s.owner === owner && s.info.projectId === input.projectId)
    if (existing) return existing.info
    if (this.sessions.size >= MAX_SESSIONS) throw new Error('最多保留 10 个终端，请先结束一个终端')

    const shell = os.userInfo().shell || process.env.SHELL || '/bin/zsh'
    const spawn = this.options.spawn ?? loadTerminalRuntime(this.options.resourcesPath).spawn
    const pty = spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cwd,
      cols: input.cols,
      rows: input.rows,
      env: terminalEnvironment(process.env),
    })
    const info: TerminalSession = {
      id: randomUUID(),
      projectId: input.projectId,
      cwd,
      shell,
      ...(warning ? { warning } : {}),
    }
    const state: SessionState = { info, owner, pty, ready: false, pending: '', paused: false }
    this.sessions.set(info.id, state)
    pty.onData((data) => {
      if (!this.sessions.has(info.id)) return
      state.pending += data
      if (state.pending.length >= OUTPUT_HIGH_WATER && !state.paused) {
        state.paused = true
        pty.pause()
      }
      if (state.ready && !state.timer) state.timer = setTimeout(() => this.flush(state), 8)
    })
    pty.onExit(({ exitCode }) => {
      state.ready = true
      this.flush(state)
      this.sessions.delete(info.id)
      this.options.onExit(owner, { sessionId: info.id, exitCode })
    })
    return info
  }

  private session(owner: number, id: string) {
    if (typeof id !== 'string' || id.length > 80) throw new Error('终端标识无效')
    const session = this.sessions.get(id)
    if (!session || session.owner !== owner) throw new Error('终端已结束或不属于当前窗口')
    return session
  }

  write(owner: number, input: TerminalData) {
    if (!input || typeof input.data !== 'string' || input.data.length > MAX_INPUT_LENGTH)
      throw new Error('终端输入无效')
    this.session(owner, input.sessionId).pty.write(input.data)
  }

  resize(owner: number, input: TerminalSizeInput) {
    if (!input) throw new Error('终端尺寸无效')
    assertSize(input.cols, input.rows)
    const session = this.session(owner, input.sessionId)
    session.pty.resize(input.cols, input.rows)
    // 首次 resize 表示渲染端已经注册会话，之后才发送启动输出。
    session.ready = true
    this.flush(session)
  }

  kill(owner: number, id: string) {
    const session = this.session(owner, id)
    this.sessions.delete(id)
    this.flush(session)
    try {
      process.kill(-session.pty.pid, 'SIGHUP')
    } catch {
      /* 进程组可能已经退出。 */
    }
    session.pty.kill()
  }

  private flush(session: SessionState) {
    if (session.timer) clearTimeout(session.timer)
    session.timer = undefined
    if (!session.ready) return
    const data = session.pending
    session.pending = ''
    if (data) this.options.onData(session.owner, { sessionId: session.info.id, data })
    if (session.paused) {
      session.paused = false
      session.pty.resume()
    }
  }

  reset() {
    this.revision += 1
    this.opening.clear()
    for (const session of [...this.sessions.values()]) {
      try {
        this.kill(session.owner, session.info.id)
      } catch {
        /* 已退出的进程无需再次终止。 */
      }
    }
  }
}
