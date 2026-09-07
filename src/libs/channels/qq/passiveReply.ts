import type { QQThreadType } from './thread'

export const QQ_MAX_PASSIVE_REPLIES = 5

const QQ_PASSIVE_REPLY_WINDOW_MS: Record<QQThreadType, number> = {
  c2c: 60 * 60 * 1000,
  dms: 5 * 60 * 1000,
  group: 5 * 60 * 1000,
  guild: 5 * 60 * 1000,
}

const QQ_PASSIVE_REPLY_WINDOW_LABEL: Record<QQThreadType, string> = {
  c2c: '单聊 60 分钟',
  dms: '频道私信 5 分钟',
  group: '群聊 5 分钟',
  guild: '频道 5 分钟',
}

export type QQPassiveReplyOptions = {
  msgId: string
  msgSeq: number
}

export type QQPassiveReplyResult =
  | { ok: true; reply: QQPassiveReplyOptions }
  | { error: string; ok: false }

/** QQ 已下线主动消息；群聊/单聊代发必须挂到最近一条入站 msg_id 上。 */
export function resolveQQPassiveReply(params: {
  hasAgentReply: boolean
  inboundCreatedAt?: Date | null
  now?: Date
  outboundCount: number
  platformMessageId?: string | null
  threadType: QQThreadType
}): QQPassiveReplyResult {
  const platformMessageId = params.platformMessageId?.trim()
  const inboundCreatedAt = params.inboundCreatedAt
  if (!platformMessageId || !inboundCreatedAt) {
    return {
      error:
        params.threadType === 'group' || params.threadType === 'guild'
          ? '群聊无法主动发消息。请先让用户在群里 @ 机器人，并在 5 分钟内回复。'
          : '无法主动发消息。请先让用户发一条消息，再在回复窗口内代发。',
      ok: false,
    }
  }

  const now = params.now ?? new Date()
  const windowMs = QQ_PASSIVE_REPLY_WINDOW_MS[params.threadType]
  if (now.getTime() - inboundCreatedAt.getTime() > windowMs) {
    return {
      error: `被动回复窗口已过期（${QQ_PASSIVE_REPLY_WINDOW_LABEL[params.threadType]}）。请让用户再发一条消息后再试。`,
      ok: false,
    }
  }

  const usedSeq = (params.hasAgentReply ? 1 : 0) + params.outboundCount
  const msgSeq = usedSeq + 1
  if (msgSeq > QQ_MAX_PASSIVE_REPLIES) {
    return {
      error: `该条消息已回复满 ${QQ_MAX_PASSIVE_REPLIES} 次，请等待用户再发消息。`,
      ok: false,
    }
  }

  return { ok: true, reply: { msgId: platformMessageId, msgSeq } }
}
