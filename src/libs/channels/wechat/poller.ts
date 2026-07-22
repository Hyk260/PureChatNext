import {
  MessageState,
  MessageType,
  WECHAT_RET_CODES,
  WechatApiClient,
  type WechatRawMessage,
} from '@pure/chat-adapter-wechat'
import debug from 'debug'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@/database/models/channelBinding'
import { type ChannelBindingItem } from '@/database/schemas/channel'
import { appEnv } from '@/envs/app'

import { setContextToken } from './contextToken'
import { decryptCredentials } from './encrypt'
import { resolveWechatWebhookSecret } from './webhookAuth'

const log = debug('channel:wechat:poller')

const DEFAULT_DURATION_MS = 8 * 60 * 1000
const MAX_RETRY_DELAY_MS = 10_000
const READY_PROBE_TIMEOUT_MS = 3000

export interface PollBindingOptions {
  durationMs?: number
  signal?: AbortSignal
  waitUntil?: (task: Promise<unknown>) => void
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      },
      { once: true },
    )
  })
}

function resolveAppBaseUrl(): string {
  const fromEnv = appEnv.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  // Local Next BFF when APP_URL (SPA) is unset
  return 'http://localhost:3000'
}

async function forwardToWebhook(
  binding: ChannelBindingItem,
  msg: WechatRawMessage,
): Promise<void> {
  const webhookUrl = `${resolveAppBaseUrl()}/api/channels/wechat/webhook/${encodeURIComponent(binding.applicationId)}`
  const secret = resolveWechatWebhookSecret()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  const res = await fetch(webhookUrl, {
    body: JSON.stringify(msg),
    headers,
    method: 'POST',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`webhook ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function handleInboundMessage(
  binding: ChannelBindingItem,
  msg: WechatRawMessage,
): Promise<void> {
  if (msg.message_type === MessageType.BOT) return
  if (msg.message_state !== MessageState.FINISH && msg.message_state !== MessageState.NEW) return

  const fromUserId = msg.from_user_id
  if (!fromUserId) return

  if (msg.context_token) {
    await setContextToken(binding.id, fromUserId, msg.context_token)
  }

  const model = new ChannelBindingModel()
  await model.touchActive(binding.id)

  try {
    await forwardToWebhook(binding, msg)
  } catch (error) {
    log('forward webhook failed binding=%s: %O', binding.id, error)
  }
}

async function processUpdates(
  binding: ChannelBindingItem,
  msgs: WechatRawMessage[] | undefined,
): Promise<void> {
  if (!msgs?.length) return
  for (const msg of msgs) {
    await handleInboundMessage(binding, msg)
  }
}

/**
 * Long-poll one binding for up to durationMs.
 * Forwards raw messages to Chat SDK webhook; on SESSION_EXPIRED (-14) marks needsRebind.
 */
export async function pollBinding(
  binding: ChannelBindingItem,
  options: PollBindingOptions = {},
): Promise<{ sessionExpired: boolean }> {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS
  const signal = options.signal
  const credentials = decryptCredentials(binding.credentials)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  const model = new ChannelBindingModel()

  const endTime = Date.now() + durationMs
  let cursor: string | undefined
  let retryDelay = 1000

  // Short probe so we fail fast on bad tokens
  {
    const probeAbort = new AbortController()
    const timer = setTimeout(() => probeAbort.abort(), READY_PROBE_TIMEOUT_MS)
    try {
      const combined = signal
        ? AbortSignal.any([signal, probeAbort.signal])
        : probeAbort.signal
      const response = await api.getUpdates(undefined, combined)
      cursor = response.get_updates_buf || undefined
      await processUpdates(binding, response.msgs)
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code
      if (code === WECHAT_RET_CODES.SESSION_EXPIRED) {
        await model.markNeedsRebind(binding.id)
        return { sessionExpired: true }
      }
      if (!probeAbort.signal.aborted && !(err as { name?: string })?.name?.includes('Abort')) {
        if (signal?.aborted) return { sessionExpired: false }
      }
    } finally {
      clearTimeout(timer)
    }
  }

  while (!signal?.aborted && Date.now() < endTime) {
    try {
      const response = await api.getUpdates(cursor, signal)
      retryDelay = 1000
      if (response.get_updates_buf) cursor = response.get_updates_buf
      await processUpdates(binding, response.msgs)
    } catch (err: unknown) {
      if (signal?.aborted) break
      const code = (err as { code?: number })?.code
      if (code === WECHAT_RET_CODES.SESSION_EXPIRED) {
        log('session expired binding=%s', binding.id)
        await model.markNeedsRebind(binding.id)
        return { sessionExpired: true }
      }
      log('poll error binding=%s: %O', binding.id, err)
      try {
        await sleep(retryDelay, signal)
      } catch {
        break
      }
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
    }
  }

  return { sessionExpired: false }
}

/**
 * Poll all enabled wechat bindings (used by cron / local gateway).
 */
export async function pollAllEnabledBindings(options: PollBindingOptions = {}): Promise<{
  polled: number
  sessionExpired: number
}> {
  const model = new ChannelBindingModel()
  const bindings = await model.findEnabledByPlatform(WECHAT_PLATFORM)
  let sessionExpired = 0

  const waitUntil = options.waitUntil ?? ((task: Promise<unknown>) => void task.catch(() => {}))

  await Promise.all(
    bindings.map(async (binding) => {
      const task = pollBinding(binding, options).then((r) => {
        if (r.sessionExpired) sessionExpired += 1
      })
      waitUntil(task)
      await task
    }),
  )

  return { polled: bindings.length, sessionExpired }
}

export { DEFAULT_DURATION_MS, WECHAT_PLATFORM }
