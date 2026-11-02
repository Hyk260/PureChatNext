import { isObjectLike } from '@pure/utils/object'
import { CHANNEL_MESSAGE_KIND_LABEL, isBailianQwenSpeechModel, speechVoiceOptions } from '@pure/const'
import { CHANNEL_LOG_LIMIT, CHANNEL_LOG_MAX_BYTES, CHANNEL_LOG_MESSAGES } from '@pure/types'
import type { ChannelGatewayLogs, ChannelLogEvent, ChannelLogInput } from '@pure/types'
import isFiniteNumber from 'es-toolkit/compat/isFinite'

type SpeechResultState = NonNullable<ChannelLogInput['speechResult']>['state']
type AgentReplyStep = NonNullable<NonNullable<ChannelLogInput['agentReply']>['steps']>[number]

const PUBLIC_ERROR_CODES = new Set([
  'Error', 'TypeError', 'AbortError', 'TimeoutError', 'SyntaxError',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
  'LEASE_LOST', 'SESSION_EXPIRED', 'PROCESSING_ERROR', 'PASSIVE_REPLY_BUDGET',
  'GATEWAY_ERROR', 'POLL_ERROR', 'FORWARD_ERROR', 'INVALID_SIGNATURE', 'INTERNAL_UNAUTHORIZED',
  'DISCONNECTED', 'WEBHOOK_FORWARD_FAILED',
  'SPEECH_CONFIGURATION', 'SPEECH_PROVIDER_DISABLED', 'SPEECH_PROVIDER_UNAVAILABLE', 'SPEECH_CREDENTIALS_MISSING',
  'SPEECH_AUDIO_SIZE', 'SPEECH_AUDIO_FORMAT', 'SPEECH_AUDIO_MISSING', 'SPEECH_RATE_LIMIT',
  'SPEECH_SYNTHESIS_FAILED', 'SPEECH_DOWNLOAD_FAILED', 'SPEECH_CONFIGURATION_FAILED', 'SPEECH_INTENT_FAILED', 'SPEECH_DELIVERY_FAILED', 'SPEECH_TAGS_UNSUPPORTED',
  'SPEECH_NOT_REQUESTED', 'SPEECH_SENT', 'SPEECH_CANCELLED', 'SPEECH_CONFIGURATION_CHANGED', 'SENDER_RATE_LIMIT', 'BINDING_RATE_LIMIT', 'CONCURRENCY_LIMIT',
  'DUPLICATE_ATTEMPT', 'BINDING_DISABLED', 'BINDING_ACCESS_CHANGED', 'QQ_REPLY_EXPIRED', 'QQ_REPLY_BUDGET',
  'QQ_PASSIVE_CONTEXT_MISSING', 'QQ_DELIVERY_UNKNOWN', 'QQ_AUTH_FAILED', 'QQ_UPLOAD_INVALID', 'QQ_INVALID_AUDIO', 'QQ_REPLY_FAILED',
])
const ERROR_EVENTS = new Set<ChannelLogEvent>([
  'authorization_failed', 'callback_failed', 'processing_failed', 'send_failed',
])
const WARNING_EVENTS = new Set<ChannelLogEvent>(['offline', 'lease_lost', 'needs_rebind', 'retry'])
const SPEECH_RESULT_DESCRIPTIONS: Record<string, string> = {
  BINDING_ACCESS_CHANGED: 'QQ 绑定权限已变化，已停止发送',
  BINDING_DISABLED: 'QQ 绑定已停用，语音未发送',
  BINDING_RATE_LIMIT: 'QQ 绑定语音频率达到上限，已回退文字',
  CONCURRENCY_LIMIT: '语音并发达到上限，已回退文字',
  DUPLICATE_ATTEMPT: '重复语音请求已忽略',
  '40034128': 'QQ 平台拒绝了本次语音发送',
  '850018': 'QQ 平台暂时无法接收本次语音',
  QQ_PASSIVE_CONTEXT_MISSING: '缺少 QQ 被动回复上下文，语音未发送',
  QQ_REPLY_BUDGET: 'QQ 回复额度不足，语音未发送',
  QQ_REPLY_EXPIRED: 'QQ 回复上下文已过期，语音未发送',
  SENDER_RATE_LIMIT: '发送者语音频率达到上限，已回退文字',
  SPEECH_AUDIO_FORMAT: '生成的音频格式不受支持',
  SPEECH_AUDIO_MISSING: '语音服务没有返回音频',
  SPEECH_AUDIO_SIZE: '生成的音频为空或超过大小限制',
  SPEECH_CANCELLED: '语音处理已取消',
  SPEECH_CONFIGURATION: '语音模型配置无效',
  SPEECH_CONFIGURATION_CHANGED: '语音设置已变化，未发送旧音频',
  SPEECH_CREDENTIALS_MISSING: '缺少语音服务 API 密钥',
  SPEECH_DELIVERY_FAILED: '音频发送失败，已回退文字',
  SPEECH_DOWNLOAD_FAILED: '语音服务音频下载失败',
  SPEECH_INTENT_FAILED: '语音意图判断失败，已回退文字',
  SPEECH_NOT_REQUESTED: '智能判断认为本次无需语音回复',
  SPEECH_PROVIDER_DISABLED: '语音服务商已停用',
  SPEECH_PROVIDER_UNAVAILABLE: '语音服务商不可用',
  SPEECH_RATE_LIMIT: '语音服务请求频率达到上限',
  SPEECH_SENT: '语音已生成并发送',
  SPEECH_SYNTHESIS_FAILED: '语音合成失败，已回退文字',
  SPEECH_TAGS_UNSUPPORTED: '所选语音模型不支持控制类与富语言类标签，已回退文字',
}

function normalizeInboundMessage(input: ChannelLogInput): string {
  const details = input.inboundMessage
  const messageKind = details?.messageKind ? CHANNEL_MESSAGE_KIND_LABEL[details.messageKind] : '消息'
  const applicationId = input.platform === 'qq' && details?.applicationId && /^\d{1,32}$/.test(details.applicationId)
    ? `，应用=${details.applicationId}`
    : ''

  if (input.event === 'webhook_inbound') return `QQ Webhook 收到已验签回调${applicationId}`

  const contactHash = details?.contactHash && /^[a-f\d]{10}$/i.test(details.contactHash)
    ? `，联系人=sha256:${details.contactHash}`
    : ''
  const contentLength = isFiniteNumber(details?.contentLength)
    ? `，长度=${Math.min(Math.max(Math.trunc(details.contentLength), 0), 1_000_000_000)}`
    : ''
  const identity = details?.identityType && details.identity && /^[\w@.-]{1,255}$/.test(details.identity)
    ? `，${details.identityType}=${details.identity}`
    : ''
  const username = details?.username ? `，username=${JSON.stringify(clampLogText(details.username, 80))}` : ''
  const content = details?.content ? `，正文=${JSON.stringify(clampLogText(details.content, 500))}` : ''
  const gateway = input.platform === 'qq' ? 'QQ Gateway' : '微信 Gateway'
  return `${gateway} 收到${messageKind}消息${applicationId}${contactHash}${identity}${username}${content}${contentLength}`
}

function clampLogText(value: string, maxLength: number): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  const characters = Array.from(normalized)
  if (characters.length <= maxLength) return normalized
  return `${characters.slice(0, maxLength).join('')}…`
}

function normalizeAgentReplyStep(step: AgentReplyStep): string {
  const safeValue = (value: string | undefined, maxLength = 100) => (value ? clampLogText(value, maxLength) : '-')
  const tools = (step.tools ?? []).slice(0, 20).map((tool) => safeValue(tool, 60)).join(',') || '-'
  const stepNumber = isFiniteNumber(step.step) ? Math.trunc(step.step) : 0
  const resultCount = isFiniteNumber(step.resultCount) ? Math.trunc(step.resultCount) : 0
  const boundedStepNumber = Math.max(0, Math.min(stepNumber, 999))
  const boundedResultCount = Math.max(0, Math.min(resultCount, 999))

  return `${boundedStepNumber}:${safeValue(step.finish, 40)} tools=${tools} results=${boundedResultCount}`
}

function normalizeAgentReply(input: ChannelLogInput): string {
  const details = input.agentReply
  const platformName = input.platform === 'qq' ? 'QQ' : '微信'
  if (!details) return `${platformName} Agent 回复已生成`

  const safeValue = (value: string | undefined, maxLength = 100) => value ? clampLogText(value, maxLength) : '-'
  const steps = (details.steps ?? []).slice(0, 20).map(normalizeAgentReplyStep)
  const available = (details.toolsAvailable ?? []).slice(0, 20).map((tool) => safeValue(tool, 60)).join(',') || '-'
  const called = (details.toolsCalled ?? []).slice(0, 20).map((tool) => safeValue(tool, 60)).join(',') || '-'
  const durationMs = isFiniteNumber(details.durationMs)
    ? Math.max(0, Math.min(Math.trunc(details.durationMs), 86_400_000))
    : 0
  const contextMessageCount = isFiniteNumber(details.contextMessageCount)
    ? Math.max(0, Math.min(Math.trunc(details.contextMessageCount), 100_000))
    : 0
  const output = details.aiOutput ? `，aiOutput=${JSON.stringify(clampLogText(details.aiOutput, 500))}` : ''
  return `${platformName} Agent 回复已生成：agentId=${safeValue(details.agentId)}，model=${safeValue(details.model)}，platform=${safeValue(details.platform)}，provider=${safeValue(details.provider)}，durationMs=${durationMs}，contextMessageCount=${contextMessageCount}，finish=${safeValue(details.finish, 40)}，tools.available=[${available}]，tools.called=[${called}]，steps=[${steps.join('; ')}]${output}`
}

function normalizeSpeechResult(input: ChannelLogInput): string {
  const details = input.speechResult
  const code = safeChannelLogCode(input.code) ?? ''
  const description = getSpeechResultDescription(code, details?.state)
  if (!details) return `${CHANNEL_LOG_MESSAGES.speech_result}：${description}`

  const safeValue = (value: string | undefined) => (value ? clampLogText(value, 100) : '-')
  const voiceId = details.voice ? safeValue(details.voice) : ''
  const voiceLabel = details.voice
    ? speechVoiceOptions(details.provider ?? '', details.model).find(({ value }) => value === details.voice)?.label
    : undefined
  const voice = voiceId && voiceLabel && voiceLabel !== details.voice ? `${safeValue(voiceLabel)}-${voiceId}` : voiceId || '-'
  const instruction = normalizeSpeechInstruction(details)

  return `${CHANNEL_LOG_MESSAGES.speech_result}：${description}，provider=${safeValue(details.provider)}，model=${safeValue(details.model)}，音色=${voice}，自定义语音指令 instruction=${instruction}`
}

function getSpeechResultDescription(code: string, state: SpeechResultState): string {
  const knownDescription = SPEECH_RESULT_DESCRIPTIONS[code]
  if (knownDescription) return knownDescription
  if (code.startsWith('SPEECH_HTTP_')) return '语音服务接口返回错误'
  if (state === 'fallback') return '语音处理未完成，已回退文字'
  if (state === 'failed') return '语音处理失败，未发送'
  if (state === 'cancelled') return '语音处理已取消'
  if (state === 'skipped') return '本次未发送语音'
  return '语音处理完成'
}

function normalizeSpeechInstruction(details: NonNullable<ChannelLogInput['speechResult']>): string {
  if (details.instructionSent) return JSON.stringify(clampLogText(details.instruction ?? '', 160))
  if (details.instructionApplicable) return '（未设置）'
  return '（当前模型不支持，未发送）'
}

/** Persist public protocol/network codes only; arbitrary messages and stack traces never enter diagnostics. */
export function safeChannelLogCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const code = String(value)
  if (/^QQ_\d{1,8}$/.test(code)) return code.slice(3)
  return PUBLIC_ERROR_CODES.has(code) || /^SPEECH_HTTP_[45]\d{2}$/.test(code) || /^\d{1,8}$/.test(code)
    ? code
    : null
}

export function channelErrorCode(error: unknown): string {
  if (!isObjectLike(error)) return 'Error'
  const details = error as { code?: unknown; name?: unknown }
  return safeChannelLogCode(details.code) || safeChannelLogCode(details.name) || 'Error'
}

export function normalizeChannelLog(input: ChannelLogInput) {
  let level: 'info' | 'warn' | 'error' = 'info'
  if (ERROR_EVENTS.has(input.event)) level = 'error'
  else if (WARNING_EVENTS.has(input.event)) level = 'warn'
  let message: string = CHANNEL_LOG_MESSAGES[input.event]
  if (input.event === 'webhook_inbound' || input.event === 'inbound_message') {
    message = normalizeInboundMessage(input)
  }
  if (input.event === 'agent_reply') message = normalizeAgentReply(input)
  if (input.event === 'speech_result') message = normalizeSpeechResult(input)
  if (input.event === 'retry') {
    if (isFiniteNumber(input.attempt)) {
      const attempt = Math.trunc(input.attempt)
      const boundedAttempt = Math.min(Math.max(attempt, 1), 9999)
      message += `，第 ${boundedAttempt} 次`
    }
    if (isFiniteNumber(input.delayMs)) {
      const delayMs = Math.trunc(input.delayMs)
      const boundedDelayMs = Math.min(Math.max(delayMs, 0), 300_000)
      message += `，${boundedDelayMs}ms 后执行`
    }
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
