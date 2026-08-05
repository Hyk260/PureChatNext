import { createHash } from 'node:crypto'

import { MessageState, MessageType, WECHAT_RET_CODES, WechatApiClient } from '@pure/chat-adapter/wechat'
import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import type { ChannelBindingItem } from '@pure/database/schemas/channel'
import { createNanoId } from '@pure/utils'
import { appEnv } from '@/envs/app'
import { decryptCredentials, encryptContextToken } from './encrypt'
import { encodeWechatFileContent, encodeWechatImageContent } from './inboundMedia'

const log = debug('channel:wechat:poller')
const DEFAULT_DURATION_MS = 8 * 60 * 1000
const POLL_LEASE_MS = 90_000
const MAX_RETRY_DELAY_MS = 10_000

export interface PollBindingOptions {
  durationMs?: number
  onStatus?: (event: PollBindingStatusEvent) => void
  owner?: string
  signal?: AbortSignal
}

export type PollBindingStatusEvent = {
  bindingId: string
  code?: string
  status: 'degraded' | 'lease_acquired' | 'lease_skipped' | 'needs_rebind' | 'online'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      },
      { once: true }
    )
  })
}

function errorDetails(error: unknown) {
  const code = String(
    (error as { code?: number | string; name?: string })?.code ?? (error as Error)?.name ?? 'POLL_ERROR'
  )
  const raw = error instanceof Error ? error.message : 'WeChat polling failed'
  return {
    code,
    message: raw.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 500),
  }
}

export function rawMessageToEvent(bindingId: string, message: WechatRawMessage) {
  if (message.message_type === MessageType.BOT) return null
  if (message.message_state !== MessageState.FINISH && message.message_state !== MessageState.NEW) return null
  const externalUserId = message.from_user_id?.trim()
  if (!externalUserId) return null
  const platformMessageId = String(message.client_id || message.message_id || '').trim()
  if (!platformMessageId) return null

  const texts = message.item_list
    .map((item) => item.text_item?.text?.trim())
    .filter((text): text is string => Boolean(text))
  const content = texts.join('\n')
  // iLink 偶发缺 type / type 与 payload 不一致；以子结构字段为准（见社区踩坑记录）
  const imageItem = message.item_list.find((item) => item.image_item)?.image_item
  const fileItem = message.item_list.find((item) => item.file_item)?.file_item

  // 媒体优先：避免「文件 + 占位文本」被当成纯文本而丢掉 file_item
  if (imageItem) {
    return {
      bindingId,
      content: encodeWechatImageContent(imageItem).slice(0, 40_000),
      encryptedContextToken: encryptContextToken(message.context_token || ''),
      externalUserId,
      messageKind: 'image' as const,
      platformMessageId: platformMessageId.slice(0, 255),
    }
  }

  if (fileItem) {
    return {
      bindingId,
      content: encodeWechatFileContent(fileItem).slice(0, 40_000),
      encryptedContextToken: encryptContextToken(message.context_token || ''),
      externalUserId,
      messageKind: 'file' as const,
      platformMessageId: platformMessageId.slice(0, 255),
    }
  }

  if (content) {
    return {
      bindingId,
      content: content.slice(0, 40_000),
      encryptedContextToken: encryptContextToken(message.context_token || ''),
      externalUserId,
      messageKind: content.startsWith('/') ? ('command' as const) : ('text' as const),
      platformMessageId: platformMessageId.slice(0, 255),
    }
  }

  // 便于排查未识别媒体：只记 type 与子结构键名，不含 token / 媒体密文
  const itemSummary = message.item_list
    .map((item) => {
      const keys = Object.keys(item).filter((key) => key !== 'type').join(',')
      return `type=${String(item.type ?? '∅')}{${keys || '∅'}}`
    })
    .join(';')
  log('unsupported inbound items binding=%s summary=%s', bindingId, itemSummary || 'empty')
  console.warn(`[微信 Gateway] 未识别消息结构 binding=${bindingId} items=${itemSummary || 'empty'}`)

  return {
    bindingId,
    content: '[unsupported message]',
    encryptedContextToken: encryptContextToken(message.context_token || ''),
    externalUserId,
    messageKind: 'unsupported' as const,
    platformMessageId: platformMessageId.slice(0, 255),
  }
}

export function formatWechatInboundLog(
  event: { bindingId: string; content: string; externalUserId: string; messageKind: string },
  includeMessageText: boolean
) {
  const contactHash = createHash('sha256').update(event.externalUserId).digest('hex').slice(0, 10)
  const kind =
    event.messageKind === 'image'
      ? '图片'
      : event.messageKind === 'file'
        ? '文件'
        : event.messageKind === 'unsupported'
          ? '非文本'
          : event.messageKind === 'command'
            ? '指令'
            : '文本'
  let detail = ''
  if (includeMessageText) {
    if (event.messageKind === 'image') {
      detail = '，内容=[图片]'
    } else if (event.messageKind === 'file') {
      detail = '，内容=[文件]'
    } else {
      const normalized = event.content
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      const visible = event.messageKind === 'command' ? normalized.split(' ')[0] : normalized.slice(0, 200)
      detail = `，内容=${JSON.stringify(visible)}${normalized.length > visible.length ? '…' : ''}`
    }
  }
  return `[微信 Gateway] 收到${kind}消息：绑定=${event.bindingId}，联系人=sha256:${contactHash}，长度=${event.content.length}${detail}`
}

/** 持久化 webhook 兼容入口；生产 Gateway 不经过 HTTP。 */
export async function ingestWechatRawMessage(binding: ChannelBindingItem, message: WechatRawMessage) {
  const event = rawMessageToEvent(binding.id, message)
  if (!event) return null
  return new ChannelEventModel().ingestAndAdvanceCursor(event, binding.id, undefined, false)
}

export async function pollBinding(
  initialBinding: ChannelBindingItem,
  options: PollBindingOptions = {}
): Promise<{ acquired: boolean; sessionExpired: boolean }> {
  const owner = options.owner ?? `poller-${createNanoId(10)()}`
  const bindingModel = new ChannelBindingModel()
  const binding = await bindingModel.acquirePollLease(initialBinding.id, owner, POLL_LEASE_MS)
  if (!binding) {
    options.onStatus?.({ bindingId: initialBinding.id, status: 'lease_skipped' })
    return { acquired: false, sessionExpired: false }
  }
  options.onStatus?.({ bindingId: binding.id, status: 'lease_acquired' })

  const credentials = decryptCredentials(binding.credentials)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  const eventModel = new ChannelEventModel()
  const endAt = Date.now() + (options.durationMs ?? DEFAULT_DURATION_MS)
  let cursor = binding.pollCursor || undefined
  let retryDelay = 1000

  try {
    while (!options.signal?.aborted && Date.now() < endAt) {
      try {
        const response = await api.getUpdates(cursor, options.signal)
        const events = (response.msgs ?? [])
          .map((message) => rawMessageToEvent(binding.id, message))
          .filter((event): event is NonNullable<typeof event> => event !== null)
        const nextCursor = response.get_updates_buf || cursor
        const inserted = await eventModel.ingestBatchAndAdvanceCursor(events, binding.id, nextCursor)
        for (const event of inserted) {
          console.log(formatWechatInboundLog(event, appEnv.WECHAT_GATEWAY_LOG_MESSAGE_TEXT))
        }
        cursor = nextCursor
        retryDelay = 1000
        options.onStatus?.({ bindingId: binding.id, status: 'online' })
        if (!(await bindingModel.renewPollLease(binding.id, owner, POLL_LEASE_MS))) break
      } catch (error) {
        if (options.signal?.aborted) break
        const details = errorDetails(error)
        if (Number(details.code) === WECHAT_RET_CODES.SESSION_EXPIRED) {
          await bindingModel.markNeedsRebind(binding.id)
          options.onStatus?.({ bindingId: binding.id, code: details.code, status: 'needs_rebind' })
          return { acquired: true, sessionExpired: true }
        }
        log('poll error binding=%s code=%s', binding.id, details.code)
        await bindingModel.markPollError(binding.id, details.code, '微信轮询暂时失败')
        options.onStatus?.({ bindingId: binding.id, code: details.code, status: 'degraded' })
        if (!(await bindingModel.renewPollLease(binding.id, owner, POLL_LEASE_MS))) break
        try {
          await sleep(retryDelay, options.signal)
        } catch {
          break
        }
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
      }
    }
  } finally {
    await bindingModel.releasePollLease(binding.id, owner)
  }

  return { acquired: true, sessionExpired: false }
}

export async function pollAllEnabledBindings(options: PollBindingOptions = {}) {
  const bindings = await new ChannelBindingModel().findEnabledByPlatform(WECHAT_PLATFORM)
  const results = await Promise.all(bindings.map((binding) => pollBinding(binding, options)))
  return {
    polled: results.filter((result) => result.acquired).length,
    sessionExpired: results.filter((result) => result.sessionExpired).length,
  }
}

export { DEFAULT_DURATION_MS, WECHAT_PLATFORM }
