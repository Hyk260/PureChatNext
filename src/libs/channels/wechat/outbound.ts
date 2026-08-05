import { WechatApiClient } from '@pure/chat-adapter/wechat'

import { decryptContextToken, decryptCredentials } from './encrypt'

export class WechatOutboundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WechatOutboundError'
  }
}

/** 仅扫码授权者本人（credentials.userId）可网页代发。 */
export function canSendWechatDevOutbound(ownerExternalUserId: string, sessionExternalUserId: string) {
  return Boolean(ownerExternalUserId && sessionExternalUserId === ownerExternalUserId)
}

/** 以 iLink BOT 身份向指定用户发送纯文本（直连，不经 LLM）。 */
export async function sendWechatOutboundText(params: {
  credentials: string
  encryptedContextToken: string
  text: string
  toUserId: string
}): Promise<void> {
  const contextToken = decryptContextToken(params.encryptedContextToken).trim()
  if (!contextToken) {
    throw new WechatOutboundError('该联系人尚无可用会话 token，请先用微信发一条消息')
  }

  const credentials = decryptCredentials(params.credentials)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  await api.sendMessage(params.toUserId, params.text, contextToken)
}
