import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { ChildProcess, SpawnOptions } from 'node:child_process'

import type { DesktopLocalToolResult } from '../../../../../src/types/desktop'

import { assertCommandAllowed } from '../security/CommandPolicy'
import { resolveCommandCwd } from '../security/PathPolicy'
import { requiresNativeApproval } from '../security/PermissionPolicy'
import type { DesktopConfig } from './DesktopConfigService'
import type { PermissionService } from './PermissionService'

const COMMAND_TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 200 * 1024

type RunningCommand = { child: ChildProcess; output: string }

const success = (content: string, data?: unknown): DesktopLocalToolResult => ({
  content,
  ...(data === undefined ? {} : { data }),
  success: true,
})

const failure = (content: string): DesktopLocalToolResult => ({ content, success: false })

export class CommandService {
  private readonly running = new Map<string, RunningCommand>()
  private readonly finished = new Map<string, string>()

  constructor(private readonly permissions: PermissionService) {}

  async run(
    topicId: string,
    mode: 'ask' | 'auto' | 'full',
    command: string,
    toolCallId: string,
    config: DesktopConfig
  ): Promise<DesktopLocalToolResult> {
    if (
      requiresNativeApproval(mode, 'command') &&
      !(await this.permissions.requestToolApproval(topicId, toolCallId, `运行命令：${command.slice(0, 120)}`))
    ) {
      return failure('终端命令需要审批')
    }
    this.permissions.assertExecutionAllowed(topicId, mode)
    assertCommandAllowed(command, mode)
    const cwd = await resolveCommandCwd(topicId, config)
    const shellId = randomUUID()
    const child = spawn(command, {
      cwd,
      env: {
        HOME: process.env.HOME ?? '',
        LANG: process.env.LANG ?? 'C',
        NODE_ENV: 'production',
        PATH: process.env.PATH ?? '',
      } as NodeJS.ProcessEnv,
      shell: true,
    } as SpawnOptions) as ChildProcess
    const state: RunningCommand = { child, output: '' }
    this.running.set(shellId, state)
    const append = (chunk: Buffer) => {
      state.output = `${state.output}${chunk.toString('utf8')}`.slice(-MAX_OUTPUT_BYTES)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    const timeout = setTimeout(() => child.kill('SIGTERM'), COMMAND_TIMEOUT_MS)
    child.once('close', () => {
      clearTimeout(timeout)
      this.running.delete(shellId)
      this.finished.set(shellId, state.output)
      if (this.finished.size > 100) {
        const oldest = this.finished.keys().next().value
        if (oldest) this.finished.delete(oldest)
      }
    })
    return success(JSON.stringify({ shellId, started: true }), { shellId })
  }

  getOutput(shellId: string) {
    const state = this.running.get(shellId)
    if (state) return success(state.output, { shellId })
    const output = this.finished.get(shellId)
    return output === undefined ? failure('命令已完成或不存在') : success(output, { shellId })
  }

  kill(shellId: string) {
    const state = this.running.get(shellId)
    if (!state) return failure('命令已完成或不存在')
    state.child.kill('SIGTERM')
    return success(`已终止命令 ${shellId}`, { shellId })
  }

  dispose() {
    for (const { child } of this.running.values()) child.kill('SIGTERM')
    this.running.clear()
    this.finished.clear()
  }
}
