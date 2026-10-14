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
type QQInboundMessageKind = NonNullable<NonNullable<ChannelLogInput['qqInbound']>['messageKind']>

const QQ_MESSAGE_KIND_LABEL: Record<QQInboundMessageKind, string> = {
  audio: '语音',
  command: '指令',
  file: '文件',
  image: '图片',
  text: '文本',
  unsupported: '非文本',
  video: '视频',
}

function normalizeQQInboundMessage(input: ChannelLogInput): string {
  const details = input.qqInbound
  const messageKind = details?.messageKind ? QQ_MESSAGE_KIND_LABEL[details.messageKind] : '消息'
  const applicationId = details?.applicationId && /^\d{1,32}$/.test(details.applicationId)
    ? `，应用=${details.applicationId}`
    : ''

  if (input.event === 'webhook_inbound') return `QQ Webhook 收到已验签回调${applicationId}`

  const contactHash = details?.contactHash && /^[a-f\d]{10}$/i.test(details.contactHash)
    ? `，联系人=sha256:${details.contactHash}`
    : ''
  const contentLength = typeof details?.contentLength === 'number' && Number.isFinite(details.contentLength)
    ? `，长度=${Math.min(Math.max(Math.trunc(details.contentLength), 0), 1_000_000_000)}`
    : ''
  const identity = details?.identityType && details.openid && /^[\w-]{1,128}$/.test(details.openid)
    ? `，${details.identityType}=${details.openid}`
    : ''
  const username = details?.username ? `，username=${JSON.stringify(clampLogText(details.username, 80))}` : ''
  const content = details?.content ? `，正文=${JSON.stringify(clampLogText(details.content, 500))}` : ''
  return `QQ Gateway 收到${messageKind}消息${applicationId}${contactHash}${identity}${username}${content}${contentLength}`
}

function clampLogText(value: string, maxLength: number): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  const characters = Array.from(normalized)
  if (characters.length <= maxLength) return normalized
  return `${characters.slice(0, maxLength).join('')}…`
}

function normalizeQQAgentReply(input: ChannelLogInput): string {
  const details = input.qqAgentReply
  if (!details) return 'QQ Agent 回复已生成'

  const safeValue = (value: string | undefined, maxLength = 100) => value ? clampLogText(value, maxLength) : '-'
  const steps = (details.steps ?? []).slice(0, 20).map((step) => {
    const stepTools = step.tools ?? []
    const tools = stepTools.length ? stepTools.slice(0, 20).map((tool) => safeValue(tool, 60)).join(',') : '-'
    const stepNumber = typeof step.step === 'number' && Number.isFinite(step.step) ? step.step : 0
    const resultCount = typeof step.resultCount === 'number' && Number.isFinite(step.resultCount) ? step.resultCount : 0
    return `${Math.max(0, Math.min(Math.trunc(stepNumber), 999))}:${safeValue(step.finish, 40)} tools=${tools} results=${Math.max(0, Math.min(Math.trunc(resultCount), 999))}`
  })
  const available = (details.toolsAvailable ?? []).slice(0, 20).map((tool) => safeValue(tool, 60)).join(',') || '-'
  const called = (details.toolsCalled ?? []).slice(0, 20).map((tool) => safeValue(tool, 60)).join(',') || '-'
  const durationMs = typeof details.durationMs === 'number' && Number.isFinite(details.durationMs)
    ? Math.max(0, Math.min(Math.trunc(details.durationMs), 86_400_000))
    : 0
  const contextMessageCount = typeof details.contextMessageCount === 'number' && Number.isFinite(details.contextMessageCount)
    ? Math.max(0, Math.min(Math.trunc(details.contextMessageCount), 100_000))
    : 0
  const output = details.aiOutput ? `，aiOutput=${JSON.stringify(clampLogText(details.aiOutput, 500))}` : ''
  return `QQ Agent 回复已生成：agentId=${safeValue(details.agentId)}，model=${safeValue(details.model)}，platform=${safeValue(details.platform)}，provider=${safeValue(details.provider)}，durationMs=${durationMs}，contextMessageCount=${contextMessageCount}，finish=${safeValue(details.finish, 40)}，tools.available=[${available}]，tools.called=[${called}]，steps=[${steps.join('; ')}]${output}`
}

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
  if (input.event === 'webhook_inbound' || input.event === 'inbound_message') {
    message = normalizeQQInboundMessage(input)
  }
  if (input.event === 'agent_reply') message = normalizeQQAgentReply(input)
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
