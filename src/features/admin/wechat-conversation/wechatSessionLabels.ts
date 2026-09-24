import type { WechatDevSession } from './wechatConversationApi'

function truncateId(id: string, head = 8, tail = 4) {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

export function wechatSessionTitle(session: WechatDevSession | null) {
  if (!session) return '选择会话'
  return session.externalUserName?.trim() || truncateId(session.externalUserId, 12, 6)
}

export function wechatAccessLabel(canSend: boolean, isOwnBinding?: boolean) {
  if (canSend) return '可代发'
  if (isOwnBinding) return '只读'
  return '其它账号'
}

export function wechatComposerPlaceholder(session: WechatDevSession | null) {
  if (!session) return '先选择会话'
  if (session.canSend) return '以 Agent 身份发送文字或附件…'
  if (session.isOwnBinding) return '仅可向扫码授权的微信账号代发'
  return '其它账号的会话，仅可查看'
}

export function formatDuration(durationMs: number): string {
  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`
}
