import type { QQMessage, QQSession } from './qqConversationApi'
import {
  createChannelExportFilename,
  createChannelFullExport,
  createChannelOpenAIExport,
  createChannelPersonalExport,
} from '@/features/channel-conversation/channelConversationExport'
import type { ChannelExportMode } from '@/features/channel-conversation/channelConversationExport'

export type QQExportMode = ChannelExportMode

type ExportSession = Pick<
  QQSession,
  'agentId' | 'agentTitle' | 'conversationVersion' | 'externalUserId' | 'externalUserName' | 'id'
>

export function createQQConversationExport(
  mode: QQExportMode,
  messages: QQMessage[],
  session: ExportSession,
  exportedAt?: string
) {
  if (mode === 'openai') return createChannelOpenAIExport(messages)
  return createChannelFullExport(messages, session, { exportedAt })
}

export function createPersonalQQConversationExport(
  mode: QQExportMode,
  messages: QQMessage[],
  session: ExportSession,
  exportedAt = new Date().toISOString()
) {
  if (mode === 'openai') return createChannelOpenAIExport(messages)
  return createChannelPersonalExport(messages, session, exportedAt)
}

export function createQQExportFilename(session: ExportSession, now = new Date()): string {
  return createChannelExportFilename('qq', session, now)
}
