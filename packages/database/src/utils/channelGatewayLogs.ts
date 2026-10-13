import {
  CHANNEL_LOG_LIMIT,
  CHANNEL_LOG_MAX_BYTES,
  CHANNEL_LOG_MESSAGES,
} from '@pure/types'
import type { ChannelGatewayLogs, ChannelLogEvent, ChannelLogInput } from '@pure/types'

const PUBLIC_ERROR_CODES = new Set([
  'Error', 'TypeError', 'AbortError', 'TimeoutError', 'SyntaxError',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
  'LEASE_LOST', 'SESSION_EXPIRED', 'PROCESSING_ERROR', 'PASSIVE_REPLY_BUDGET',
  'GATEWAY_ERROR', 'POLL_ERROR', 'FORWARD_ERROR', 'INVALID_SIGNATURE', 'INTERNAL_UNAUTHORIZED',
  'DISCONNECTED', 'WEBHOOK_FORWARD_FAILED',
])
const ERROR_EVENTS = new Set<ChannelLogEvent>([
  'authorization_failed', 'callback_failed', 'processing_failed', 'send_failed',
])
const WARNING_EVENTS = new Set<ChannelLogEvent>(['offline', 'lease_lost', 'needs_rebind', 'retry'])

/** Persist public protocol/network codes only; arbitrary messages and stack traces never enter diagnostics. */
export function safeChannelLogCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const code = String(value)
  return PUBLIC_ERROR_CODES.has(code) || /^\d{1,8}$/.test(code) ? code : null
}

export function channelErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Error'
  const details = error as { code?: unknown; name?: unknown }
  return safeChannelLogCode(details.code) || safeChannelLogCode(details.name) || 'Error'
}

export function normalizeChannelLog(input: ChannelLogInput) {
  let level: 'info' | 'warn' | 'error' = 'info'
  if (ERROR_EVENTS.has(input.event)) level = 'error'
  else if (WARNING_EVENTS.has(input.event)) level = 'warn'
  let message: string = CHANNEL_LOG_MESSAGES[input.event]
  if (input.event === 'retry') {
    if (typeof input.attempt === 'number' && Number.isFinite(input.attempt)) message += `，第 ${Math.min(Math.max(Math.trunc(input.attempt), 1), 9999)} 次`
    if (typeof input.delayMs === 'number' && Number.isFinite(input.delayMs)) message += `，${Math.min(Math.max(Math.trunc(input.delayMs), 0), 300_000)}ms 后执行`
  }
  return { level, message, code: safeChannelLogCode(input.code) } as const
}

type LogLine = { createdAt: Date; level: string; event: ChannelLogEvent; message: string; code: string | null }

export function formatChannelGatewayLogs(rows: LogLine[]): ChannelGatewayLogs {
  const lines: string[] = []
  let bytes = Buffer.byteLength(JSON.stringify({ text: '', truncated: false }), 'utf8')
  let truncated = rows.length >= CHANNEL_LOG_LIMIT
  // Keep the newest complete records, then display them in chronological order.
  for (const row of rows) {
    const code = safeChannelLogCode(row.code)
    const line = `${row.createdAt.toISOString()} [${row.level.toUpperCase()}] [${row.event}] ${row.message}${code ? ` (${code})` : ''}`
    const size = Buffer.byteLength(JSON.stringify(line), 'utf8') - 2 + (lines.length ? 2 : 0)
    if (bytes + size > CHANNEL_LOG_MAX_BYTES) {
      truncated = true
      break
    }
    lines.push(line)
    bytes += size
  }
  return { text: lines.reverse().join('\n'), truncated }
}
