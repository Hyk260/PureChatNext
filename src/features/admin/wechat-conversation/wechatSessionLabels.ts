import type { WechatDevSession } from './wechatConversationApi'
import { channelAccessLabel, truncateId } from '@/features/admin/channel-conversation/channelUi'

export function wechatSessionTitle(session: WechatDevSession | null) {
  if (!session) return '选择会话'
  return session.externalUserName?.trim() || truncateId(session.externalUserId, 12, 6)
}

export function wechatAccessLabel(canSend: boolean, isOwnBinding?: boolean) {
  return channelAccessLabel(canSend, isOwnBinding)
}

export function wechatComposerPlaceholder(session: WechatDevSession | null) {
  if (!session) return '先选择会话'
  if (session.canSend) return '以 Agent 身份发送文字或附件…'
  if (session.isOwnBinding) return '仅可向扫码授权的微信账号代发'
  return '其它账号的会话，仅可查看'
}
