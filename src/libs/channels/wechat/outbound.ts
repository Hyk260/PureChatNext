import { MessageItemType, WechatApiClient, WechatUploadMediaType } from '@pure/chat-adapter/wechat'
import type { MessageItem } from '@pure/chat-adapter/wechat'

import { decryptContextToken, decryptCredentials } from './encrypt'
import { WECHAT_MAX_INBOUND_FILE_BYTES } from './inboundMedia'

export class WechatOutboundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WechatOutboundError'
  }
}

export type WechatOutboundMedia = {
  buffer: Buffer
  fileName: string
  mimeType: string
}

/** 仅扫码授权者本人（credentials.userId）可网页代发。 */
export function canSendWechatDevOutbound(ownerExternalUserId: string, sessionExternalUserId: string) {
  return Boolean(ownerExternalUserId && sessionExternalUserId === ownerExternalUserId)
}

function resolveContextToken(encryptedContextToken: string) {
  const contextToken = decryptContextToken(encryptedContextToken).trim()
  if (!contextToken) {
    throw new WechatOutboundError('该联系人尚无可用会话 token，请先用微信发一条消息')
  }
  return contextToken
}

function isImageMedia(media: WechatOutboundMedia) {
  return media.mimeType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(media.fileName)
}

function buildMediaItem(media: WechatOutboundMedia, uploaded: { aesKey: string; encryptQueryParam: string }): MessageItem {
  const cdnMedia = {
    aes_key: uploaded.aesKey,
    encrypt_query_param: uploaded.encryptQueryParam,
    encrypt_type: 1 as const,
  }
  if (isImageMedia(media)) {
    return {
      image_item: { media: cdnMedia },
      type: MessageItemType.IMAGE,
    }
  }
  return {
    file_item: {
      file_name: media.fileName,
      len: String(media.buffer.byteLength),
      media: cdnMedia,
    },
    type: MessageItemType.FILE,
  }
}

/** 以 iLink BOT 身份向指定用户发送文本与附件（直连，不经 LLM）。 */
export async function sendWechatOutbound(params: {
  credentials: string
  encryptedContextToken: string
  media?: WechatOutboundMedia[]
  onMediaSent?: (index: number) => Promise<void> | void
  onTextSent?: () => Promise<void> | void
  text?: string
  toUserId: string
}): Promise<void> {
  const text = params.text?.trim() ?? ''
  const media = params.media ?? []
  if (!text && media.length === 0) {
    throw new WechatOutboundError('请输入文字或选择附件')
  }
  for (const item of media) {
    if (item.buffer.byteLength <= 0) {
      throw new WechatOutboundError(`附件「${item.fileName}」为空`)
    }
    if (item.buffer.byteLength > WECHAT_MAX_INBOUND_FILE_BYTES) {
      throw new WechatOutboundError(`附件「${item.fileName}」超过 10MB 限制`)
    }
  }

  const contextToken = resolveContextToken(params.encryptedContextToken)
  const credentials = decryptCredentials(params.credentials)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)

  if (text) {
    await api.sendMessage(params.toUserId, text, contextToken)
    await params.onTextSent?.()
  }

  for (const [index, item] of media.entries()) {
    const mediaType = isImageMedia(item) ? WechatUploadMediaType.IMAGE : WechatUploadMediaType.FILE
    const uploaded = await api.uploadCdnMedia(params.toUserId, mediaType, item.buffer)
    await api.sendItem(params.toUserId, buildMediaItem(item, uploaded), contextToken)
    await params.onMediaSent?.(index)
  }
}

/** 以 iLink BOT 身份向指定用户发送纯文本（直连，不经 LLM）。 */
export async function sendWechatOutboundText(params: {
  credentials: string
  encryptedContextToken: string
  text: string
  toUserId: string
}): Promise<void> {
  await sendWechatOutbound(params)
}
