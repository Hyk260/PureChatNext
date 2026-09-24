export type ChannelExportMode = 'full' | 'openai'

export type ChannelExportSession = {
  agentId: string
  agentTitle: string | null
  conversationVersion: number
  externalUserId: string
  externalUserName: string | null
  id: string
}

export type ChannelExportMessage = {
  attachments?: unknown
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

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null)) as T
}

export function createChannelOpenAIExport(messages: ChannelExportMessage[]) {
  return messages
    .filter((message) => {
      if (message.status !== 'completed' || !message.text.trim()) return false
      if (message.messageKind && message.messageKind !== 'text') return false
      return message.source === 'user' || message.source === 'model'
    })
    .map(({ role, text }) => ({ content: text.trim(), role }))
}

export function createChannelFullExport(
  messages: ChannelExportMessage[],
  session: ChannelExportSession,
  options?: { compactNulls?: boolean; exportedAt?: string }
) {
  const exportedAt = options?.exportedAt ?? new Date().toISOString()
  const exportable = messages.filter((message) => message.source !== 'manual')
  const mapMessage = (message: ChannelExportMessage) => {
    const row = {
      attachments: message.attachments,
      authorId: message.authorId,
      authorName: message.authorName,
      content: message.text,
      createdAt: message.createdAt,
      durationMs: message.durationMs,
      eventId: message.eventId,
      fileName: message.fileName,
      fileSize: message.fileSize,
      fileUrl: message.fileUrl,
      id: message.id,
      imageUrl: message.imageUrl,
      messageKind: message.messageKind,
      model: message.model,
      provider: message.provider,
      role: message.role,
      source: message.source,
      status: message.status,
    }
    return options?.compactNulls ? compact(row) : row
  }
  const sessionRow = {
    agentId: session.agentId,
    agentTitle: session.agentTitle,
    conversationVersion: session.conversationVersion,
    externalUserId: session.externalUserId,
    externalUserName: session.externalUserName,
    id: session.id,
  }
  return {
    exportedAt,
    messages: exportable.map(mapMessage),
    session: options?.compactNulls ? compact(sessionRow) : sessionRow,
    version: '1.0',
  }
}

export function createChannelExportFilename(
  platform: string,
  session: ChannelExportSession,
  now = new Date()
): string {
  const label =
    (session.externalUserName || session.externalUserId || 'conversation')
      .replace(/[\\/:*?"<>|\s]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'conversation'
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${platform}-${label}-v${session.conversationVersion}-${timestamp}.json`
}
