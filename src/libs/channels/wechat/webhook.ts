import { createHash } from 'node:crypto'

import { MessageState, MessageType } from '@pure/chat-adapter/wechat'
import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import { ChannelEventModel } from '@pure/database/models/channelEvent'
import type { ChannelBindingItem } from '@pure/database/schemas/channel'
import { buildChannelGatewayHeaders, buildChannelGatewayWebhookUrl } from '@/server/channel-gateway/internal'

import { encodeWechatFileContent, encodeWechatImageContent } from './content'
import { encryptContextToken } from './encrypt'
import type { WechatPollBatch } from './poller'

const log = debug('channel:wechat:webhook')

export function rawMessageToEvent(bindingId: string, message: WechatRawMessage) {
  if (message.message_type === MessageType.BOT) return null
  if (message.message_state !== MessageState.FINISH && message.message_state !== MessageState.NEW) return null
  const externalUserId = message.from_user_id?.trim()
  const platformMessageId = String(message.client_id || message.message_id || '').trim()
  if (!externalUserId || !platformMessageId) return null
  const itemList = Array.isArray(message.item_list) ? message.item_list : []
  const texts = itemList.map((item) => item.text_item?.text?.trim()).filter((text): text is string => Boolean(text))
  const content = texts.join('\n')
  const imageItem = itemList.find((item) => item.image_item)?.image_item
  const fileItem = itemList.find((item) => item.file_item)?.file_item
  const common = {
    bindingId,
    encryptedContextToken: encryptContextToken(message.context_token || ''),
    externalUserId,
    platformMessageId: platformMessageId.slice(0, 255),
  }
  if (imageItem) return { ...common, content: encodeWechatImageContent(imageItem).slice(0, 40_000), messageKind: 'image' as const }
  if (fileItem) return { ...common, content: encodeWechatFileContent(fileItem).slice(0, 40_000), messageKind: 'file' as const }
  if (content) return { ...common, content: content.slice(0, 40_000), messageKind: content.startsWith('/') ? 'command' as const : 'text' as const }
  const summary = itemList.map((item) => `type=${String(item.type ?? '∅')}{${Object.keys(item).filter((key) => key !== 'type').join(',') || '∅'}}`).join(';')
  log('unsupported inbound items binding=%s summary=%s', bindingId, summary || 'empty')
  return { ...common, content: '[unsupported message]', messageKind: 'unsupported' as const }
}

export function formatWechatInboundLog(event: {
  bindingId: string
  content: string
  externalUserId: string
  externalUserName?: string | null
  messageKind: string
}) {
  const contactHash = createHash('sha256').update(event.externalUserId).digest('hex').slice(0, 10)
  const labels: Record<string, string> = { command: '指令', file: '文件', image: '图片', text: '文本', unsupported: '非文本' }
  const visible = event.messageKind === 'image'
    ? '，内容=[图片]'
    : event.messageKind === 'file'
      ? '，内容=[文件]'
      : event.messageKind === 'text' || event.messageKind === 'command'
        ? `，内容=${JSON.stringify(event.content.replace(/[\r\n\t]+/g, ' ').slice(0, 200))}`
        : ''
  const userName = event.externalUserName?.trim()
  return `[微信 Gateway] 收到${labels[event.messageKind] ?? '文本'}消息：绑定=${event.bindingId}，联系人=sha256:${contactHash}${userName ? `，用户=${JSON.stringify(userName)}` : ''}，长度=${event.content.length}${visible}`
}

export async function ingestWechatWebhookBatch(binding: ChannelBindingItem, batch: WechatPollBatch) {
  const events = batch.messages
    .map((message) => rawMessageToEvent(binding.id, message))
    .filter((event): event is NonNullable<typeof event> => event !== null)
  const inserted = await new ChannelEventModel().ingestBatchAndAdvanceCursor(events, binding.id, batch.cursor)
  for (const event of inserted) log(formatWechatInboundLog(event))
  return inserted
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    }, { once: true })
  })
}

export async function forwardWechatBatch(applicationId: string, batch: WechatPollBatch, signal: AbortSignal) {
  const url = buildChannelGatewayWebhookUrl(`/api/channels/wechat/webhook/${encodeURIComponent(applicationId)}`)
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(url, {
        body: JSON.stringify({ get_updates_buf: batch.cursor, msgs: batch.messages }),
        headers: buildChannelGatewayHeaders('wechat'),
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`WeChat webhook returned ${response.status}`)
      return
    } catch (error) {
      lastError = error
      if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      if (attempt < 4) await abortableDelay(1000 * 2 ** attempt, signal)
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('WeChat webhook delivery failed')
}
