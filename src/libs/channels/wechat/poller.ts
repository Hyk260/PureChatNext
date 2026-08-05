import { MessageState, MessageType, WECHAT_RET_CODES, WechatApiClient } from '@pure/chat-adapter/wechat'
import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import type { ChannelBindingItem } from '@pure/database/schemas/channel'
import { createNanoId } from '@pure/utils'
import { decryptCredentials, encryptContextToken } from './encrypt'

const log = debug('channel:wechat:poller')
const DEFAULT_DURATION_MS = 8 * 60 * 1000
const POLL_LEASE_MS = 90_000
const MAX_RETRY_DELAY_MS = 10_000

export interface PollBindingOptions {
  durationMs?: number
  owner?: string
  signal?: AbortSignal
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
  const code = String((error as { code?: number | string; name?: string })?.code ?? (error as Error)?.name ?? 'POLL_ERROR')
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
  const unsupported = !content

  return {
    bindingId,
    content: unsupported ? '[unsupported message]' : content.slice(0, 40_000),
    encryptedContextToken: encryptContextToken(message.context_token || ''),
    externalUserId,
    messageKind: unsupported ? ('unsupported' as const) : content.startsWith('/') ? ('command' as const) : ('text' as const),
    platformMessageId: platformMessageId.slice(0, 255),
  }
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
  if (!binding) return { acquired: false, sessionExpired: false }

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
        await eventModel.ingestBatchAndAdvanceCursor(events, binding.id, nextCursor)
        cursor = nextCursor
        retryDelay = 1000
        if (!(await bindingModel.renewPollLease(binding.id, owner, POLL_LEASE_MS))) break
      } catch (error) {
        if (options.signal?.aborted) break
        const details = errorDetails(error)
        if (Number(details.code) === WECHAT_RET_CODES.SESSION_EXPIRED) {
          await bindingModel.markNeedsRebind(binding.id)
          return { acquired: true, sessionExpired: true }
        }
        log('poll error binding=%s code=%s', binding.id, details.code)
        await bindingModel.markPollError(binding.id, details.code, '微信轮询暂时失败')
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
