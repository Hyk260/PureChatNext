// @vitest-environment node
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { IPty } from '@lydell/node-pty'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TerminalService, terminalEnvironment } from '../TerminalService'

let root: string
const services: TerminalService[] = []

function setup(projectCount = 2) {
  const projects = Array.from({ length: projectCount }, (_, i) => ({
    accessConfirmed: true,
    id: `p${i}`,
    name: `Project ${i}`,
    rootPath: root,
    createdAt: 0,
  }))
  const ptys: Array<ReturnType<typeof fakePty>> = []
  const spawn = vi.fn(() => {
    const pty = fakePty()
    ptys.push(pty)
    return pty as unknown as IPty
  })
  const onData = vi.fn()
  const onExit = vi.fn()
  const service = new TerminalService({
    config: { listProjects: vi.fn(async () => projects) },
    desktopPath: root,
    platform: 'darwin',
    spawn,
    onData,
    onExit,
  })
  services.push(service)
  return { service, spawn, ptys, projects, onData, onExit }
}

function fakePty() {
  let data: (data: string) => void = () => {}
  let exit: (event: { exitCode: number }) => void = () => {}
  return {
    pid: 1_000_000_000,
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: (callback: typeof data) => {
      data = callback
    },
    onExit: (callback: typeof exit) => {
      exit = callback
    },
    emit: (value: string) => data(value),
    finish: (exitCode: number) => exit({ exitCode }),
    kill: vi.fn(() => exit({ exitCode: 0 })),
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'terminal-service-'))
})

afterEach(async () => {
  services.splice(0).forEach((service) => service.reset())
  await rm(root, { recursive: true, force: true })
})

const size = { cols: 80, rows: 24 }

describe('TerminalService', () => {
  it('deduplicates concurrent opening and keeps projects isolated', async () => {
    const { service, spawn, ptys } = setup()
    const [first, same] = await Promise.all([
      service.open(1, { projectId: 'p0', ...size }),
      service.open(1, { projectId: 'p0', ...size }),
    ])
    expect(first.id).toBe(same.id)
    const second = await service.open(1, { projectId: 'p1', ...size })
    expect(second.id).not.toBe(first.id)
    expect((await service.open(1, { projectId: 'p0', ...size })).id).toBe(first.id)
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(ptys[0].kill).not.toHaveBeenCalled()
  })

  it('buffers initial output until renderer is ready and flushes before exit', async () => {
    const { service, ptys, onData, onExit } = setup()
    const session = await service.open(7, { projectId: null, ...size })
    ptys[0].emit('启动提示符')
    expect(onData).not.toHaveBeenCalled()
    service.resize(7, { sessionId: session.id, ...size })
    expect(onData).toHaveBeenCalledWith(7, { sessionId: session.id, data: '启动提示符' })
    ptys[0].emit('done')
    ptys[0].finish(2)
    expect(onData).toHaveBeenLastCalledWith(7, { sessionId: session.id, data: 'done' })
    expect(onExit).toHaveBeenCalledWith(7, { sessionId: session.id, exitCode: 2 })
  })

  it('validates directory, size, input and session ownership', async () => {
    const { service, projects } = setup()
    const session = await service.open(1, { projectId: 'p0', ...size })
    expect(() => service.write(2, { sessionId: session.id, data: 'pwd\r' })).toThrow('不属于当前窗口')
    expect(() => service.resize(1, { sessionId: session.id, cols: Number.NaN, rows: 24 })).toThrow('尺寸无效')
    expect(() => service.write(1, { sessionId: session.id, data: 'a'.repeat(65537) })).toThrow('输入无效')
    await expect(service.open(1, { projectId: 'missing', ...size })).rejects.toThrow('项目不存在')
    projects[1].rootPath = path.join(root, 'missing')
    await expect(service.open(1, { projectId: 'p1', ...size })).rejects.toThrow('不可访问')
  })

  it('does not open a terminal in an unconfirmed legacy project', async () => {
    const { service, projects, spawn } = setup()
    projects[0].accessConfirmed = false

    await expect(service.open(1, { projectId: 'p0', ...size })).rejects.toThrow('项目目录尚未由用户确认')
    expect(spawn).not.toHaveBeenCalled()
  })

  it('preserves startup errors when the shell exits before the renderer attaches', async () => {
    const { service, ptys, onData, onExit } = setup()
    const session = await service.open(1, { projectId: null, ...size })
    ptys[0].emit('shell startup failed')
    ptys[0].finish(1)
    expect(onData).toHaveBeenCalledWith(1, { sessionId: session.id, data: 'shell startup failed' })
    expect(onExit).toHaveBeenCalledWith(1, { sessionId: session.id, exitCode: 1 })
  })

  it('falls back from an unavailable Desktop with a visible warning', async () => {
    const service = new TerminalService({
      config: { listProjects: async () => [] },
      desktopPath: path.join(root, 'absent'),
      platform: 'darwin',
      spawn: () => fakePty() as unknown as IPty,
      onData: vi.fn(),
      onExit: vi.fn(),
    })
    services.push(service)
    expect(await service.open(1, { projectId: null, ...size })).toMatchObject({
      cwd: os.homedir(),
      warning: expect.any(String),
    })
  })

  it('refuses an eleventh session without evicting running shells', async () => {
    const { service, ptys } = setup(11)
    for (let i = 0; i < 10; i++) await service.open(1, { projectId: `p${i}`, ...size })
    await expect(service.open(1, { projectId: 'p10', ...size })).rejects.toThrow('最多保留 10')
    expect(ptys.every((pty) => pty.kill.mock.calls.length === 0)).toBe(true)
  })

  it('cancels pending opening on reset and terminates existing sessions', async () => {
    const { service, ptys } = setup()
    await service.open(1, { projectId: 'p0', ...size })
    const pending = service.open(1, { projectId: 'p1', ...size })
    service.reset()
    await expect(pending).rejects.toThrow('终端已关闭')
    expect(ptys[0].kill).toHaveBeenCalledOnce()
  })

  it('keeps the shell environment free of application secrets', async () => {
    await mkdir(path.join(root, 'Desktop'))
    expect(
      terminalEnvironment({ HOME: '/Users/test', PATH: '/bin', DATABASE_URL: 'secret', OPENAI_API_KEY: 'secret' })
    ).toEqual({
      HOME: '/Users/test',
      PATH: '/bin',
      LANG: 'en_US.UTF-8',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    })
  })
})
