import type { QQDevMessage, QQDevSession } from './qqConversationApi'

export type QQExportMode = 'full' | 'openai'

type ExportSession = Pick<
  QQDevSession,
  'agentId' | 'agentTitle' | 'conversationVersion' | 'externalUserId' | 'externalUserName' | 'id'
>

export function createQQConversationExport(
  mode: QQExportMode,
  messages: QQDevMessage[],
  session: ExportSession,
  exportedAt?: string
) {
  const exportableMessages = messages.filter((message) => message.source !== 'manual')

  if (mode === 'openai') {
    return exportableMessages
      .filter((message) => {
        if (message.status !== 'completed' || !message.text.trim()) return false
        if (message.messageKind && message.messageKind !== 'text') return false
        return message.source === 'user' || message.source === 'model'
      })
      .map(({ role, text }) => ({ content: text.trim(), role }))
  }

  return {
    exportedAt: exportedAt ?? new Date().toISOString(),
    messages: exportableMessages.map((message) => ({
      attachments: message.attachments,
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
    })),
    session: {
      agentId: session.agentId,
      agentTitle: session.agentTitle,
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      externalUserName: session.externalUserName,
      id: session.id,
    },
    version: '1.0',
  }
}

export function createQQExportFilename(session: ExportSession, now = new Date()): string {
  const label = (session.externalUserName || session.externalUserId || 'conversation')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'conversation'
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `qq-${label}-v${session.conversationVersion}-${timestamp}.json`
}
