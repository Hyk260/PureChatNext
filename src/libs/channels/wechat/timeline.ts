import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

import { parseWechatFileContent } from './inboundMedia'

export type TimelineMessage = {
  createdAt: string
  eventId: string
  fileName?: string
  fileSize?: number | null
  fileUrl?: string
  id: string
  imageUrl?: string
  messageKind?: string
  role: 'assistant' | 'user'
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
      status: event.status,
      text: isImage ? '[图片]' : isFile ? '[文件]' : event.content,
    })
    if (event.responseText) {
      messages.push({
        createdAt: (event.completedAt ?? event.createdAt).toISOString(),
        eventId: event.id,
        id: `${event.id}:assistant`,
        messageKind: event.messageKind,
        role: 'assistant',
        status: event.status,
        text: event.responseText,
      })
    }
  }
  return messages
}
