import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

export type QQTimelineMessage = {
  attachments?: Array<{
    deliveryStatus: string
    fileName: string
    fileSize?: number | null
    fileUrl: string
    id: string
    summary?: string
    version: number
  }>
  authorId?: string
  authorName?: string
  createdAt: string
  durationMs?: number
  eventId: string
  fileName?: string
  fileSize?: number | null
  fileUrl?: string
  id: string
  imageUrl?: string
  messageKind?: string
  model?: string
  provider?: string
  role: 'assistant' | 'user'
  source: 'manual' | 'model' | 'system' | 'user'
  status?: string
  text: string
}

type QQAttachmentPayload = {
  mimeType?: string
  name?: string
  size?: number
  type?: string
  url?: string
}

const USER_KIND_TEXT: Record<string, string> = {
  audio: '[语音]',
  file: '[文件]',
  image: '[图片]',
  unsupported: '[不支持的消息]',
  video: '[视频]',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function readQQAttachments(payload: Record<string, unknown> | null | undefined): QQAttachmentPayload[] {
  if (!payload || !Array.isArray(payload.attachments)) return []
  return payload.attachments.filter(isRecord).map((item) => ({
    mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
    name: typeof item.name === 'string' ? item.name : undefined,
    size: typeof item.size === 'number' ? item.size : undefined,
    type: typeof item.type === 'string' ? item.type : undefined,
    url: typeof item.url === 'string' ? item.url : undefined,
  }))
}

function readQQAuthor(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return {}
  const authorId = typeof payload.authorId === 'string' ? payload.authorId.trim() : ''
  const rawName = typeof payload.authorName === 'string' ? payload.authorName.trim() : ''
  const authorName = rawName && rawName !== authorId ? rawName : ''
  return {
    ...(authorId ? { authorId } : {}),
    ...(authorName ? { authorName } : {}),
  }
}

const QQ_THREAD_TITLE_PREFIXES = ['QQ 群聊', 'QQ 单聊', 'QQ 频道私信', 'QQ 频道'] as const

function isQQPersonName(name: string) {
  return Boolean(name) && !QQ_THREAD_TITLE_PREFIXES.some((prefix) => name.startsWith(prefix))
}

function collectQQAuthorNames(
  events: ChannelTimelineEvent[],
  sessionUserName?: string | null
): Map<string, string> {
  const names = new Map<string, string>()
  let lastAuthorId = ''
  for (const event of events) {
    if (event.messageKind === 'outbound') continue
    const author = readQQAuthor(event.platformPayload)
    if (author.authorId) lastAuthorId = author.authorId
    if (author.authorId && author.authorName) names.set(author.authorId, author.authorName)
  }
  const hint = sessionUserName?.trim()
  if (hint && isQQPersonName(hint) && lastAuthorId && !names.has(lastAuthorId)) {
    names.set(lastAuthorId, hint)
  }
  return names
}

function mapQQAttachments(event: ChannelTimelineEvent) {
  return readQQAttachments(event.platformPayload)
    .filter((attachment) => Boolean(attachment.url))
    .map((attachment, index) => ({
      deliveryStatus: 'available',
      fileName: attachment.name || attachment.mimeType || '附件',
      fileSize: attachment.size,
      fileUrl: attachment.url!,
      id: `${event.id}:attachment:${index}`,
      version: 1,
    }))
}

/** 将 QQ channel_events 时间线展开为 Dev 会话气泡；附件直接使用 QQ 原始 URL。 */
export function expandQQEventsToMessages(
  events: ChannelTimelineEvent[],
  options?: { sessionUserName?: string | null }
): QQTimelineMessage[] {
  const messages: QQTimelineMessage[] = []
  const authorNames = collectQQAuthorNames(events, options?.sessionUserName)
  for (const event of events) {
    if (event.messageKind === 'outbound') {
      const text = event.responseText?.trim() || ''
      if (!text) continue
      messages.push({
        createdAt: (event.completedAt ?? event.createdAt).toISOString(),
        eventId: event.id,
        id: `${event.id}:assistant`,
        messageKind: event.messageKind,
        role: 'assistant',
        source: 'manual',
        status: event.status,
        text,
      })
      continue
    }

    const attachments = mapQQAttachments(event)
    const author = readQQAuthor(event.platformPayload)
    const authorName = author.authorName || (author.authorId ? authorNames.get(author.authorId) : undefined)
    const firstImage = attachments.find(({ fileName }) =>
      (fileName || '').match(/\.(jpe?g|png|gif|webp|bmp)$/i)
    ) ?? attachments[0]
    const firstFile = attachments.find(({ fileName }) =>
      !(fileName || '').match(/\.(jpe?g|png|gif|webp|bmp)$/i)
    )
    const isImage = event.messageKind === 'image'

    messages.push({
      ...(attachments.length ? { attachments } : {}),
      ...(author.authorId ? { authorId: author.authorId } : {}),
      ...(authorName ? { authorName } : {}),
      createdAt: event.createdAt.toISOString(),
      eventId: event.id,
      ...(isImage && firstImage
        ? {
            fileName: firstImage.fileName,
            fileSize: firstImage.fileSize,
            fileUrl: firstImage.fileUrl,
            imageUrl: firstImage.fileUrl,
          }
        : firstFile
          ? {
              fileName: firstFile.fileName,
              fileSize: firstFile.fileSize,
              fileUrl: firstFile.fileUrl,
            }
          : {}),
      id: `${event.id}:user`,
      messageKind: event.messageKind,
      role: 'user',
      source: 'user',
      status: event.status,
      text: USER_KIND_TEXT[event.messageKind] ?? event.content,
    })

    if (event.responseText) {
      messages.push({
        createdAt: (event.completedAt ?? event.createdAt).toISOString(),
        ...(event.durationMs === null ? {} : { durationMs: event.durationMs }),
        ...(event.model ? { model: event.model } : {}),
        ...(event.provider ? { provider: event.provider } : {}),
        eventId: event.id,
        id: `${event.id}:assistant`,
        messageKind: event.messageKind,
        role: 'assistant',
        source: event.model && event.provider ? 'model' : 'system',
        status: event.status,
        text: event.responseText,
      })
    }
  }
  return messages
}
