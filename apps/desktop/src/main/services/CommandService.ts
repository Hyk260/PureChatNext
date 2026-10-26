import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { ChildProcess, SpawnOptions } from 'node:child_process'

import type { DesktopCommandExecution, DesktopLocalToolResult } from '@/types/desktop'

import { assertCommandAllowed } from '../security/CommandPolicy'
import { resolveCommandCwd } from '../security/PathPolicy'
import type { DesktopConfig } from './DesktopConfigService'
import type { PermissionService } from './PermissionService'

const COMMAND_TIMEOUT_MS = 30_000
const COMMAND_KILL_GRACE_MS = 2_000
const MAX_OUTPUT_BYTES = 200 * 1024
const MAX_FINISHED_COMMANDS = 100

type RunningCommand = {
  cancelled: boolean
  child: ChildProcess
  command: string
  cwd: string
  killTimer?: ReturnType<typeof setTimeout>
  output: Buffer
  startedAt: number
  timedOut: boolean
  toolCallId: string
  topicId: string
  truncated: boolean
}

const success = (content: string, data?: unknown, execution?: DesktopCommandExecution): DesktopLocalToolResult => ({
  content,
  ...(data === undefined ? {} : { data }),
  ...(execution === undefined ? {} : { execution }),
  success: true,
})

const failure = (content: string, data?: unknown, execution?: DesktopCommandExecution): DesktopLocalToolResult => ({
  content,
  ...(data === undefined ? {} : { data }),
  ...(execution === undefined ? {} : { execution }),
  success: false,
})

const getOutputText = (execution: DesktopCommandExecution) =>
  execution.output || (execution.status === 'completed' ? '命令执行成功，没有产生输出。' : '命令没有产生输出。')

const getCommandKey = (topicId: string, toolCallId: string) => JSON.stringify([topicId, toolCallId])

export class CommandService {
  private readonly running = new Map<string, RunningCommand>()
  private readonly finished = new Map<string, DesktopCommandExecution>()
  private readonly cancelledToolCalls = new Map<string, number>()

  constructor(private readonly permissions: PermissionService) {}

  async run(
    topicId: string,
    toolCallId: string,
    mode: 'ask' | 'auto' | 'full',
    command: string,
    config: DesktopConfig
  ): Promise<DesktopLocalToolResult> {
    this.permissions.assertExecutionAllowed(topicId, mode)
    assertCommandAllowed(command, mode)
    const cwd = await resolveCommandCwd(topicId, config)
    const shellId = randomUUID()
    const cancellationKey = getCommandKey(topicId, toolCallId)
    this.removeExpiredCancellations()

    if (this.cancelledToolCalls.has(cancellationKey)) {
      this.cancelledToolCalls.delete(cancellationKey)
      return this.finishBeforeStart(shellId, command, cwd, 'cancelled')
    }

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
    const state: RunningCommand = {
      cancelled: false,
      child,
      command,
      cwd,
      output: Buffer.alloc(0),
      startedAt: Date.now(),
      timedOut: false,
      toolCallId,
      topicId,
      truncated: false,
    }
    this.running.set(shellId, state)

    const append = (chunk: Buffer) => {
      const nextOutput = Buffer.concat([state.output, chunk])
      if (nextOutput.length > MAX_OUTPUT_BYTES) {
        state.output = nextOutput.subarray(nextOutput.length - MAX_OUTPUT_BYTES)
        state.truncated = true
        return
      }
      state.output = nextOutput
    }

    child.stdout?.on('data', append)
    child.stderr?.on('data', append)

    return new Promise((resolve) => {
      let settled = false
      const timeout = setTimeout(() => {
        state.timedOut = true
        this.terminate(state)
      }, COMMAND_TIMEOUT_MS)

      const finish = (exitCode: number | null, signal: NodeJS.Signals | null, spawnError?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (state.killTimer) clearTimeout(state.killTimer)
        this.running.delete(shellId)

        const output = [state.output.toString('utf8'), spawnError?.message].filter(Boolean).join('\n')
        const status = state.cancelled
          ? 'cancelled'
          : state.timedOut
            ? 'timedOut'
            : spawnError || exitCode !== 0
              ? 'failed'
              : 'completed'
        const execution: DesktopCommandExecution = {
          command,
          cwd,
          durationMs: Math.max(0, Date.now() - state.startedAt),
          exitCode,
          output: state.truncated ? `[较早的输出已截断]\n${output}` : output,
          shellId,
          signal,
          startedAt: state.startedAt,
          status,
          truncated: state.truncated,
        }

        this.finished.set(shellId, execution)
        if (this.finished.size > MAX_FINISHED_COMMANDS) {
          const oldest = this.finished.keys().next().value
          if (oldest) this.finished.delete(oldest)
        }

        const content = getOutputText(execution)
        resolve(
          status === 'completed' ? success(content, { shellId }, execution) : failure(content, { shellId }, execution)
        )
      }

      child.once('error', (error) => finish(null, null, error))
      child.once('close', (code, signal) => finish(code, signal))
    })
  }

  getOutput(shellId: string) {
    const state = this.running.get(shellId)
    if (state) return success(state.output.toString('utf8'), { shellId, status: 'running' })

    const execution = this.finished.get(shellId)
    if (!execution) return failure('命令已完成或不存在')

    const content = getOutputText(execution)
    return execution.status === 'completed'
      ? success(content, { shellId }, execution)
      : failure(content, { shellId }, execution)
  }

  kill(shellId: string) {
    const state = this.running.get(shellId)
    if (!state) return failure('命令已完成或不存在')
    state.cancelled = true
    this.terminate(state)
    return success(`已终止命令 ${shellId}`, { shellId })
  }

  cancel(topicId: string, toolCallId: string) {
    const state = [...this.running.values()].find(
      (command) => command.topicId === topicId && command.toolCallId === toolCallId
    )
    if (state) {
      state.cancelled = true
      this.terminate(state)
      return
    }

    this.removeExpiredCancellations()
    this.cancelledToolCalls.set(getCommandKey(topicId, toolCallId), Date.now() + COMMAND_TIMEOUT_MS)
    if (this.cancelledToolCalls.size > MAX_FINISHED_COMMANDS) {
      const oldestKey = this.cancelledToolCalls.keys().next().value
      if (oldestKey) this.cancelledToolCalls.delete(oldestKey)
    }
  }

  dispose() {
    for (const state of this.running.values()) this.terminate(state)
    this.running.clear()
    this.finished.clear()
    this.cancelledToolCalls.clear()
  }

  private finishBeforeStart(shellId: string, command: string, cwd: string, status: DesktopCommandExecution['status']) {
    const execution: DesktopCommandExecution = {
      command,
      cwd,
      durationMs: 0,
      exitCode: null,
      output: '命令在启动前已取消。',
      shellId,
      signal: null,
      startedAt: Date.now(),
      status,
      truncated: false,
    }
    this.finished.set(shellId, execution)
    return failure(execution.output, { shellId }, execution)
  }

  private terminate(state: RunningCommand) {
    state.child.kill('SIGTERM')
    if (!state.killTimer) {
      state.killTimer = setTimeout(() => state.child.kill('SIGKILL'), COMMAND_KILL_GRACE_MS)
    }
  }

  private removeExpiredCancellations() {
    const now = Date.now()
    for (const [key, expiresAt] of this.cancelledToolCalls) {
      if (expiresAt <= now) this.cancelledToolCalls.delete(key)
    }
  }
}
