'use client'

import { isRecord } from '@pure/utils/object'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import type { UIMessage } from 'ai'

import type { DesktopCommandExecution } from '@/types/desktop'

const styles = createStaticStyles(({ css }) => ({
  card: css`
    overflow: hidden;
    width: 100%;
    margin-block: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorFillQuaternary};
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    padding: 8px 12px;
    color: ${cssVar.colorTextSecondary};
    font-size: 13px;
  `,
  spinner: css`
    animation: command-execution-spin 1s linear infinite;

    @keyframes command-execution-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  command: css`
    overflow: hidden;
    flex: 1;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  duration: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  output: css`
    overflow: auto;
    max-height: 320px;
    margin: 0;
    padding: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    color: ${cssVar.colorText};
    font-family: ${cssVar.fontFamilyCode};
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  `,
  exitCode: css`
    padding: 7px 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    color: ${cssVar.colorTextTertiary};
    font-size: 12px;
  `,
}))

export type CommandExecutionPart = UIMessage['parts'][number] & {
  errorText?: string
  input?: unknown
  output?: unknown
  state: string
  toolCallId: string
  type: 'tool-runCommand'
}

export const isCommandExecutionPart = (part: UIMessage['parts'][number]): part is CommandExecutionPart =>
  part.type === 'tool-runCommand'

const getExecution = (output: unknown): DesktopCommandExecution | undefined => {
  if (!isRecord(output) || !isRecord(output.execution)) return undefined
  const execution = output.execution
  const status = execution.status
  if (
    typeof execution.command !== 'string' ||
    typeof execution.cwd !== 'string' ||
    typeof execution.durationMs !== 'number' ||
    !(typeof execution.exitCode === 'number' || execution.exitCode === null) ||
    typeof execution.output !== 'string' ||
    typeof execution.shellId !== 'string' ||
    !(typeof execution.signal === 'string' || execution.signal === null) ||
    typeof execution.startedAt !== 'number' ||
    !(status === 'cancelled' || status === 'completed' || status === 'failed' || status === 'timedOut') ||
    typeof execution.truncated !== 'boolean'
  ) {
    return undefined
  }

  return {
    command: execution.command,
    cwd: execution.cwd,
    durationMs: execution.durationMs,
    exitCode: execution.exitCode,
    output: execution.output,
    shellId: execution.shellId,
    signal: execution.signal,
    startedAt: execution.startedAt,
    status,
    truncated: execution.truncated,
  }
}

const getCommand = (input: unknown) =>
  isRecord(input) && typeof input.command === 'string' ? input.command : '终端命令'

const formatDuration = (durationMs: number) => {
  if (durationMs < 1000) return `用时 ${durationMs} 毫秒`
  if (durationMs < 60_000) {
    const seconds = durationMs / 1000
    return `用时 ${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} 秒`
  }

  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.round((durationMs % 60_000) / 1000)
  return seconds > 0 ? `用时 ${minutes} 分 ${seconds} 秒` : `用时 ${minutes} 分钟`
}

const CommandExecutionCard = ({ part, running }: { part: CommandExecutionPart; running: boolean }) => {
  const execution = getExecution(part.output)
  const isRunning = running && !execution
  const command = execution?.command ?? getCommand(part.input)
  const output =
    execution?.output ||
    (isRecord(part.output) && typeof part.output.content === 'string' ? part.output.content : part.errorText)
  const isSuccessful =
    execution?.status === 'completed' ||
    (!execution && part.state === 'output-available' && isRecord(part.output) && part.output.success === true)
  const statusText = isRunning
    ? '正在运行'
    : isSuccessful
      ? '已运行'
      : execution?.status === 'cancelled'
        ? '已停止'
        : execution?.status === 'timedOut'
          ? '运行超时'
          : execution?.status === 'failed'
            ? '运行失败'
            : execution?.exitCode === null || execution?.exitCode === undefined
              ? '运行失败'
              : `退出码 ${execution.exitCode}`

  if (!execution && !isRunning && !output) return null

  return (
    <section
      aria-label='命令执行结果'
      className={styles.card}
      data-command-status={isRunning ? 'running' : (execution?.status ?? 'failed')}
    >
      <div className={styles.header}>
        {isRunning ? (
          <LoaderCircle className={cx('flex-none', styles.spinner)} size={16} aria-hidden />
        ) : isSuccessful ? (
          <CircleCheck className='flex-none' size={16} aria-hidden />
        ) : (
          <CircleAlert className='flex-none' size={16} aria-hidden />
        )}
        <span>{statusText}</span>
        <code className={styles.command} title={command}>
          {command}
        </code>
        {execution ? (
          <span className={cx(styles.duration, 'flex-none text-xs')}>{formatDuration(execution.durationMs)}</span>
        ) : null}
      </div>
      {output ? <pre className={styles.output}>{output}</pre> : null}
      {execution && execution.exitCode !== 0 ? (
        <div className={styles.exitCode}>
          {execution.exitCode === null ? '进程未返回退出码' : `退出码：${execution.exitCode}`}
          {execution.signal ? ` · 信号：${execution.signal}` : ''}
        </div>
      ) : null}
    </section>
  )
}

export default CommandExecutionCard
