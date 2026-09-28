import { QQApiClient, toQQMediaFileType } from '@pure/chat-adapter/qq'
import type { ChannelBindingItem, ChannelSessionItem } from '@pure/database/schemas/channel'

import { normalizeQQChannelSettings, chunkQQOutboundText } from './advancedSettings'
import { decryptCredentials } from './encrypt'
import { QQ_MAX_OUTBOUND_FILE_BYTES, qqOutboundFileLimitLabel } from './outboundLimits'
import { QQ_MAX_PASSIVE_REPLIES } from './passiveReply'
import type { QQPassiveReplyOptions } from './passiveReply'
import { parseQQThreadId } from './thread'

export class QQOutboundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QQOutboundError'
  }
}

export type QQOutboundMedia = {
  buffer: Buffer
  fileName: string
  mimeType: string
}

export function canSendQQDevOutbound(
  binding: ChannelBindingItem,
  session: Pick<ChannelSessionItem, 'bindingId'>
): boolean {
  return binding.enabled && !binding.needsRebind && session.bindingId === binding.id
}

function isImageMedia(media: QQOutboundMedia) {
  return toQQMediaFileType(media.mimeType, media.fileName) === 1
}

/** 网页代发 QQ 文本 / 附件；必须携带被动回复的 msg_id，否则群聊会返回 40034105。 */
export async function sendQQDevOutbound(params: {
  binding: ChannelBindingItem
  media?: QQOutboundMedia[]
  onMediaSent?: (index: number) => Promise<void> | void
  onTextSent?: (chunkCount: number) => Promise<void> | void
  reply: QQPassiveReplyOptions
  session: ChannelSessionItem
  text?: string
}): Promise<{ sentCount: number }> {
  const text = params.text?.trim() ?? ''
  const media = params.media ?? []
  if (!text && media.length === 0) {
    throw new QQOutboundError('请输入文字或选择附件')
  }
  for (const item of media) {
    if (item.buffer.byteLength <= 0) {
      throw new QQOutboundError(`附件「${item.fileName}」为空`)
    }
    if (item.buffer.byteLength > QQ_MAX_OUTBOUND_FILE_BYTES) {
      throw new QQOutboundError(`附件「${item.fileName}」超过 ${qqOutboundFileLimitLabel()} 限制`)
    }
  }

  const target = parseQQThreadId(params.session.externalUserId)
  if (media.length > 0 && target.type !== 'group' && target.type !== 'c2c') {
    throw new QQOutboundError('当前会话类型不支持发送附件（仅单聊 / 群聊）')
  }
  if (target.type === 'group' && media.some((item) => !isImageMedia(item))) {
    throw new QQOutboundError('群聊仅支持发送图片附件')
  }

  const charLimit = normalizeQQChannelSettings(params.binding.settings).charLimit
  const textChunks = text ? chunkQQOutboundText(text, charLimit) : []
  const messageCount = textChunks.length + media.length
  if (params.reply.msgSeq + messageCount - 1 > QQ_MAX_PASSIVE_REPLIES) {
    throw new QQOutboundError(`该条消息剩余被动回复次数不足（需 ${messageCount} 次，上限 ${QQ_MAX_PASSIVE_REPLIES}）`)
  }

  const credentials = decryptCredentials(params.binding.credentials)
  const api = new QQApiClient(credentials.appId, credentials.appSecret)
  let msgSeq = params.reply.msgSeq
  let sentCount = 0

  const nextReply = () => {
    const reply = { msgId: params.reply.msgId, msgSeq }
    msgSeq += 1
    return reply
  }

  for (const chunk of textChunks) {
    const replyOpts = nextReply()
    switch (target.type) {
      case 'group':
        await api.sendGroupMessage(target.id, chunk, replyOpts)
        break
      case 'guild':
        await api.sendGuildMessage(target.id, chunk, replyOpts)
        break
      case 'c2c':
        await api.sendC2CMessage(target.id, chunk, replyOpts)
        break
      case 'dms':
        await api.sendDmsMessage(target.id, chunk, replyOpts)
        break
      default:
        throw new QQOutboundError('当前会话类型不支持代发文本')
    }
    sentCount += 1
    await params.onTextSent?.(1)
  }

  for (const [index, item] of media.entries()) {
    const fileType = toQQMediaFileType(item.mimeType, item.fileName)
    const fileData = item.buffer.toString('base64')
    const uploaded =
      target.type === 'group'
        ? await api.uploadGroupRichMedia(target.id, fileType, { fileData })
        : await api.uploadC2CRichMedia(target.id, fileType, { fileData })
    const replyOpts = nextReply()
    if (target.type === 'group') {
      await api.sendGroupMedia(target.id, uploaded.file_info, replyOpts)
    } else {
      await api.sendC2CMedia(target.id, uploaded.file_info, replyOpts)
    }
    sentCount += 1
    await params.onMediaSent?.(index)
  }

  return { sentCount }
}
