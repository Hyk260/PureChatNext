import { QQApiClient } from '@pure/chat-adapter/qq'
import type { QQSendMessageResponse } from '@pure/chat-adapter/qq'

import type { ChannelBindingItem, ChannelSessionItem } from '@pure/database/schemas/channel'

import { decryptCredentials } from './encrypt'
import { parseQQThreadId } from './thread'

export function canSendQQDevOutbound(
  binding: ChannelBindingItem,
  session: Pick<ChannelSessionItem, 'bindingId'>
): boolean {
  return binding.enabled && !binding.needsRebind && session.bindingId === binding.id
}

/** 网页代发 QQ 文本消息；目标线程取自会话的 externalUserId。 */
export async function sendQQDevOutbound(params: {
  binding: ChannelBindingItem
  session: ChannelSessionItem
  text: string
}): Promise<QQSendMessageResponse> {
  const credentials = decryptCredentials(params.binding.credentials)
  const api = new QQApiClient(credentials.appId, credentials.appSecret)
  const target = parseQQThreadId(params.session.externalUserId)
  const text = params.text.trim()

  switch (target.type) {
    case 'group':
      return api.sendGroupMessage(target.id, text)
    case 'guild':
      return api.sendGuildMessage(target.id, text)
    case 'c2c':
      return api.sendC2CMessage(target.id, text)
    case 'dms':
      return api.sendDmsMessage(target.id, text)
  }
}
