import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

import { parseWechatFileContent } from './inboundMedia'

export type TimelineMessage = {
  attachments?: Array<{
    deliveryError?: string
    deliveryStatus: string
    fileName: string
    fileSize: number
    fileUrl: string
    id: string
    summary?: string
    version: number
  }>
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

function parseFileSize(len?: string): number | null {
  if (!len) return null
  const n = Number(len)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** 将 channel_events 时间线展开为 Dev 会话气泡（outbound 仅 assistant）。 */
export function expandEventsToMessages(events: ChannelTimelineEvent[]): TimelineMessage[] {
  const messages: TimelineMessage[] = []
  for (const event of events) {
    if (event.messageKind === 'outbound') {
      if (event.responseText) {
        messages.push({
          createdAt: (event.completedAt ?? event.createdAt).toISOString(),
          eventId: event.id,
          id: `${event.id}:assistant`,
          messageKind: event.messageKind,
          role: 'assistant',
          source: 'manual',
          status: event.status,
          text: event.responseText,
        })
      }
      continue
    }

    const isImage = event.messageKind === 'image'
    const isFile = event.messageKind === 'file'
    const filePayload = isFile ? parseWechatFileContent(event.content) : null

    messages.push({
      createdAt: event.createdAt.toISOString(),
      eventId: event.id,
      id: `${event.id}:user`,
      ...(isImage ? { imageUrl: `/api/dev/wechat/events/${event.id}/image` } : {}),
      ...(isFile
        ? {
            fileName: filePayload?.file_name || '未命名文件',
            fileSize: parseFileSize(filePayload?.len),
            fileUrl: `/api/dev/wechat/events/${event.id}/file`,
          }
        : {}),
      messageKind: event.messageKind,
      role: 'user',
      source: 'user',
      status: event.status,
      text: isImage ? '[图片]' : isFile ? '[文件]' : event.content,
    })
    if (event.responseText) {
      const outputAttachments = event.attachments
        .filter(({ direction }) => direction === 'output')
        .map((attachment) => ({
          ...(attachment.deliveryError ? { deliveryError: attachment.deliveryError } : {}),
          deliveryStatus: attachment.deliveryStatus,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          fileUrl: `/api/resources/files/${attachment.fileId}/content`,
          id: attachment.id,
          ...(attachment.summary ? { summary: attachment.summary } : {}),
          version: attachment.version,
        }))
      messages.push({
        ...(outputAttachments.length ? { attachments: outputAttachments } : {}),
        createdAt: (event.completedAt ?? event.createdAt).toISOString(),
        eventId: event.id,
        id: `${event.id}:assistant`,
        messageKind: event.messageKind,
        ...(event.durationMs === null ? {} : { durationMs: event.durationMs }),
        ...(event.model ? { model: event.model } : {}),
        ...(event.provider ? { provider: event.provider } : {}),
        role: 'assistant',
        source: event.model && event.provider ? 'model' : 'system',
        status: event.status,
        text: event.responseText,
      })
    }
  }
  return messages
}
