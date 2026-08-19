import { WECHAT_RET_CODES, WechatApiClient } from '@pure/chat-adapter/wechat'
import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import type { ChannelBindingItem } from '@pure/database/schemas/channel'

import { decryptCredentials } from './encrypt'

const log = debug('channel:wechat:poller')
const DEFAULT_POLL_TIMEOUT_MS = 40_000
const POLL_TIMEOUT_MARGIN_MS = 2_000
const MIN_POLL_TIMEOUT_MS = 5_000
const MAX_POLL_TIMEOUT_MS = 60_000
const MAX_RETRY_DELAY_MS = 10_000

export type WechatPollBatch = { cursor?: string; messages: WechatRawMessage[] }

export type WechatPollOptions = {
  forwardBatch: (batch: WechatPollBatch, signal: AbortSignal) => Promise<void>
  onReady?: () => void
  onSessionExpired?: () => void
  onStatus?: (event: { code?: string; message?: string; status: 'degraded' | 'online' }) => void
  signal: AbortSignal
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

function errorDetails(error: unknown) {
  const code = String((error as { code?: number | string; name?: string })?.code ?? (error as Error)?.name ?? 'POLL_ERROR')
  const raw = error instanceof Error ? error.message : 'WeChat polling failed'
  return { code, message: raw.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 500) }
}

function resolvePollTimeoutMs(serverTimeoutMs?: number): number | undefined {
  if (!Number.isFinite(serverTimeoutMs) || serverTimeoutMs === undefined || serverTimeoutMs <= 0) return undefined
  return Math.min(
    Math.max(Math.round(serverTimeoutMs) + POLL_TIMEOUT_MARGIN_MS, MIN_POLL_TIMEOUT_MS),
    MAX_POLL_TIMEOUT_MS
  )
}

/** Long-poll iLink and forward complete protocol batches. Lease and persistence belong to the caller/Webhook. */
export async function pollWechatUpdates(binding: ChannelBindingItem, options: WechatPollOptions): Promise<void> {
  const credentials = decryptCredentials(binding.credentials)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  let cursor = binding.pollCursor || undefined
  let pollTimeoutMs: number | undefined = DEFAULT_POLL_TIMEOUT_MS
  let retryDelay = 1_000
  let ready = false

  while (!options.signal.aborted) {
    try {
      const response = await api.getUpdates(cursor, options.signal, pollTimeoutMs)
      const nextCursor = response.get_updates_buf || cursor
      await options.forwardBatch({ cursor: nextCursor, messages: response.msgs ?? [] }, options.signal)
      cursor = nextCursor
      pollTimeoutMs = resolvePollTimeoutMs(response.longpolling_timeout_ms) ?? DEFAULT_POLL_TIMEOUT_MS
      retryDelay = 1_000
      options.onStatus?.({ status: 'online' })
      if (!ready) {
        ready = true
        options.onReady?.()
      }
    } catch (error) {
      // 只在本 client 被 stop 时退出。getUpdates 的 AbortSignal.timeout 在部分
      // runtime 也会抛 AbortError，当成中止会导致首次轮询失败后永远等不到心跳。
      if (options.signal.aborted) return
      const details = errorDetails(error)
      if (Number(details.code) === WECHAT_RET_CODES.SESSION_EXPIRED) {
        options.onSessionExpired?.()
        return
      }
      log('poll failed binding=%s code=%s', binding.id, details.code)
      options.onStatus?.({ ...details, status: 'degraded' })
      await abortableDelay(retryDelay, options.signal)
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
    }
  }
}

export { WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
export { formatWechatInboundLog, rawMessageToEvent } from './webhook'
