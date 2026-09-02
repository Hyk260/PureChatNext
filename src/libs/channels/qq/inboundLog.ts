import { createHash } from 'node:crypto'

const QQ_ATTACHMENT_KIND = {
  audio: 'audio',
  file: 'file',
  image: 'image',
  video: 'video',
} as const

const QQ_KIND_LABEL: Record<string, string> = {
  audio: '语音',
  command: '指令',
  file: '文件',
  image: '图片',
  text: '文本',
  unsupported: '非文本',
  video: '视频',
}

const QQ_KIND_PLACEHOLDER: Record<string, string> = {
  audio: '，内容=[语音]',
  file: '，内容=[文件]',
  image: '，内容=[图片]',
  video: '，内容=[视频]',
}

export function resolveQQInboundKind(input: { attachments?: Array<{ type?: string }>; text?: string | null }) {
  const attachmentType = input.attachments?.find((item) => item.type)?.type
  if (attachmentType && attachmentType in QQ_ATTACHMENT_KIND) return attachmentType
  const text = input.text?.trim()
  if (!text) return 'unsupported'
  if (text.startsWith('/')) return 'command'
  return 'text'
}

function formatInboundVisibleContent(event: { content: string; messageKind: string }) {
  if (event.messageKind === 'text' || event.messageKind === 'command') {
    return `，内容=${JSON.stringify(event.content.replace(/[\r\n\t]+/g, ' ').slice(0, 200))}`
  }
  return QQ_KIND_PLACEHOLDER[event.messageKind] ?? ''
}

export function formatQQInboundLog(event: {
  applicationId: string
  content: string
  externalUserId: string
  messageKind: string
}) {
  const contactHash = createHash('sha256').update(event.externalUserId).digest('hex').slice(0, 10)
  return `[QQ Gateway] 收到${QQ_KIND_LABEL[event.messageKind] ?? '文本'}消息：应用=${event.applicationId}，联系人=sha256:${contactHash}，长度=${event.content.length}${formatInboundVisibleContent(event)}`
}
