import { formatInboundVisibleContent } from '../core/logging'
import { CHANNEL_MESSAGE_KIND_LABEL } from '@pure/const'
import { createHash } from 'node:crypto'

import debug from 'debug'

import { recordChannelGatewayLog } from '@/server/channel-gateway/diagnostics'

const log = debug('channel:qq:webhook')

const QQ_ATTACHMENT_KIND = {
  audio: 'audio',
  file: 'file',
  image: 'image',
  video: 'video',
} as const

export type QQInboundKind = 'audio' | 'command' | 'file' | 'image' | 'text' | 'unsupported' | 'video'

export function formatQQUnsupportedMessage(messageKind: 'audio' | 'video'): string {
  const kindLabel = messageKind === 'audio' ? '语音' : '视频'
  return `当前版本暂不支持${kindLabel}消息，请发送文本、图片或文件。`
}

export function resolveQQInboundKind(input: { attachments?: Array<{ type?: string }>; text?: string | null }): QQInboundKind {
  const attachmentType = input.attachments?.find((item) => item.type)?.type
  if (attachmentType && attachmentType in QQ_ATTACHMENT_KIND) return attachmentType as QQInboundKind
  const text = input.text?.trim()
  if (!text) return 'unsupported'
  if (text.startsWith('/')) return 'command'
  return 'text'
}

export function formatQQAttachmentContext(
  attachments?: Array<{ mimeType?: string; name?: string; size?: number; type?: string }>
): string | undefined {
  if (!attachments?.length) return undefined

  return attachments
    .map((attachment) => {
      const details = [attachment.name, attachment.mimeType || attachment.type, attachment.size ? `${attachment.size} bytes` : undefined]
        .filter(Boolean)
        .join(', ')
      return `[附件${details ? `: ${details}` : ''}]`
    })
    .join('\n')
}

export function formatQQInboundLog(event: {
  applicationId: string
  content: string
  externalUserId: string
  messageKind: string
}) {
  const contactHash = createHash('sha256').update(event.externalUserId).digest('hex').slice(0, 10)
  return `[QQ Gateway] 收到${CHANNEL_MESSAGE_KIND_LABEL[event.messageKind] ?? '文本'}消息：应用=${event.applicationId}，联系人=sha256:${contactHash}，长度=${event.content.length}${formatInboundVisibleContent(event)}`
}

export async function recordQQInboundDiagnostic(event: {
  applicationId: string
  bindingId: string
  content: string
  externalUserId: string
  identityType: 'member_openid' | 'user_openid'
  messageKind: QQInboundKind
  openid: string
  username?: string | null
  userId: string
}): Promise<void> {
  const contactHash = createHash('sha256').update(event.externalUserId).digest('hex').slice(0, 10)
  await recordChannelGatewayLog({
    bindingId: event.bindingId,
    event: 'inbound_message',
    platform: 'qq',
    inboundMessage: {
      applicationId: event.applicationId,
      contactHash,
      contentLength: event.content.length,
      content: event.content,
      identityType: event.identityType,
      messageKind: event.messageKind,
      identity: event.openid,
      username: event.username ?? undefined,
    },
    userId: event.userId,
  })
}

export async function recordQQAgentReplyDiagnostic(event: {
  aiOutput: string
  bindingId: string
  contextMessageCount: number
  durationMs: number
  finish?: string
  model: string
  platform: string
  provider: string
  steps: Array<{ finish: string; resultCount: number; step: number; tools: string[] }>
  toolsAvailable: string[]
  toolsCalled: string[]
  agentId: string
  userId: string
}): Promise<void> {
  await recordChannelGatewayLog({
    bindingId: event.bindingId,
    event: 'agent_reply',
    platform: 'qq',
    agentReply: {
      agentId: event.agentId,
      aiOutput: event.aiOutput,
      contextMessageCount: event.contextMessageCount,
      durationMs: event.durationMs,
      finish: event.finish,
      model: event.model,
      platform: event.platform,
      provider: event.provider,
      steps: event.steps,
      toolsAvailable: event.toolsAvailable,
      toolsCalled: event.toolsCalled,
    },
    userId: event.userId,
  })
}

export function logQQInbound(event: Parameters<typeof formatQQInboundLog>[0]): void {
  log(formatQQInboundLog(event))
}
