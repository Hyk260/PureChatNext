import { QQApiClient } from '@pure/chat-adapter/qq'
import type { QQSendMessageResponse } from '@pure/chat-adapter/qq'

import type { ChannelBindingItem, ChannelSessionItem } from '@pure/database/schemas/channel'

import { decryptCredentials } from './encrypt'
import type { QQPassiveReplyOptions } from './passiveReply'
import { parseQQThreadId } from './thread'

export function canSendQQDevOutbound(
  binding: ChannelBindingItem,
  session: Pick<ChannelSessionItem, 'bindingId'>
): boolean {
  return binding.enabled && !binding.needsRebind && session.bindingId === binding.id
}

/** 网页代发 QQ 文本消息；必须携带被动回复的 msg_id，否则群聊会返回 40034105。 */
export async function sendQQDevOutbound(params: {
  binding: ChannelBindingItem
  reply: QQPassiveReplyOptions
  session: ChannelSessionItem
  text: string
}): Promise<QQSendMessageResponse> {
  const credentials = decryptCredentials(params.binding.credentials)
  const api = new QQApiClient(credentials.appId, credentials.appSecret)
  const target = parseQQThreadId(params.session.externalUserId)
  const text = params.text.trim()
  const replyOpts = { msgId: params.reply.msgId, msgSeq: params.reply.msgSeq }

  switch (target.type) {
    case 'group':
      return api.sendGroupMessage(target.id, text, replyOpts)
    case 'guild':
      return api.sendGuildMessage(target.id, text, replyOpts)
    case 'c2c':
      return api.sendC2CMessage(target.id, text, replyOpts)
    case 'dms':
      return api.sendDmsMessage(target.id, text, replyOpts)
  }
}
