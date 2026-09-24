import type { QQMessage, QQSession } from './qqConversationApi'
import { truncateId } from '@/features/admin/channel-conversation/channelUi'

function isQQGroupSession(session: QQSession | null) {
  return session?.threadType === 'group' || Boolean(session?.externalUserId.startsWith('qq:group:'))
}

function qqGroupOpenId(externalUserId: string) {
  return externalUserId.replace(/^qq:group:/, '')
}

export function qqSessionTitle(session: QQSession | null) {
  if (!session) return '选择会话'
  if (isQQGroupSession(session)) return `QQ 群聊 ${truncateId(qqGroupOpenId(session.externalUserId), 8, 4)}`
  return session.externalUserName?.trim() || truncateId(session.externalUserId, 12, 6) || '选择会话'
}

export function qqMessageUserLabel(message: QQMessage, session: QQSession | null) {
  const name = message.authorName?.trim()
  if (name) return name
  if (isQQGroupSession(session)) {
    return message.authorId?.trim() ? `用户 ${truncateId(message.authorId, 6, 4)}` : 'QQ 用户'
  }
  return session?.externalUserName?.trim() || 'QQ 用户'
}

export function qqComposerPlaceholder(session: QQSession) {
  if (!session.canSend) return '当前会话仅可查看'
  if (isQQGroupSession(session)) return '以 Agent 身份回复（需用户 5 分钟内 @ 过机器人）'
  return '以 Agent 身份发送文字…'
}
