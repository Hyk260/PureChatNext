import type { WechatDevMessage, WechatDevSession } from './wechatConversationApi'
import {
  createChannelExportFilename,
  createChannelFullExport,
  createChannelOpenAIExport,
  createChannelPersonalExport,
} from '@/features/channel-conversation/channelConversationExport'
import type { ChannelExportMode } from '@/features/channel-conversation/channelConversationExport'

export type WechatExportMode = ChannelExportMode

type ExportSession = Pick<
  WechatDevSession,
  'agentId' | 'agentTitle' | 'conversationVersion' | 'externalUserId' | 'externalUserName' | 'id'
>

export function createWechatConversationExport(
  mode: WechatExportMode,
  messages: WechatDevMessage[],
  session: ExportSession,
  exportedAt = new Date().toISOString()
) {
  if (mode === 'openai') return createChannelOpenAIExport(messages)
  return createChannelFullExport(messages, session, { compactNulls: true, exportedAt })
}

export function createPersonalWechatConversationExport(
  mode: WechatExportMode,
  messages: WechatDevMessage[],
  session: ExportSession,
  exportedAt = new Date().toISOString()
) {
  if (mode === 'openai') return createChannelOpenAIExport(messages)
  return createChannelPersonalExport(messages, session, exportedAt)
}

export function createWechatExportFilename(session: ExportSession, now = new Date()): string {
  return createChannelExportFilename('wechat', session, now)
}
