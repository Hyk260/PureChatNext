import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

export function buildManualTimelineMessage<T>(event: ChannelTimelineEvent, attachments: T[]) {
  const text = event.responseText?.trim() || ''
  if (!text && attachments.length === 0) return null
  return {
    ...(attachments.length ? { attachments } : {}),
    createdAt: (event.completedAt ?? event.createdAt).toISOString(),
    eventId: event.id,
    id: `${event.id}:assistant`,
    messageKind: event.messageKind,
    role: 'assistant' as const,
    source: 'manual' as const,
    status: event.status,
    text: text || '[附件]',
  }
}
