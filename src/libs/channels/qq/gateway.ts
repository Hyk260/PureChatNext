import { createMemoryState } from '@chat-adapter/state-memory'
import { createQQAdapter } from '@pure/chat-adapter-qq'
import { Chat } from 'chat'
import debug from 'debug'

import { ChannelBindingModel, QQ_PLATFORM } from '@/database/models/channelBinding'
import { type ChannelBindingItem } from '@/database/schemas/channel'
import { appEnv } from '@/envs/app'

import { decryptCredentials, type QQCredentials } from './encrypt'
import { resolveQQWebhookSecret } from './webhookAuth'

const log = debug('channel:qq:gateway')

/** Default WS session window before refresh (align with LobeHub ~8h). */
export const DEFAULT_QQ_GATEWAY_DURATION_MS = 8 * 60 * 60 * 1000

function resolveAppBaseUrl(): string {
  const fromEnv = appEnv.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'http://localhost:3000'
}

function buildWebhookUrl(applicationId: string): string {
  return `${resolveAppBaseUrl()}/api/channels/qq/webhook/${encodeURIComponent(applicationId)}`
}

function buildWebhookHeaders(): Record<string, string> {
  const secret = resolveQQWebhookSecret()
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

/**
 * Run WebSocket gateway for a single websocket-mode binding.
 * Dispatch events are POSTed to the internal webhook.
 */
export async function runQQGatewayForBinding(
  binding: ChannelBindingItem,
  options?: {
    durationMs?: number
    signal?: AbortSignal
    waitUntil?: (task: Promise<unknown>) => void
  },
): Promise<void> {
  const credentials = decryptCredentials(binding.credentials)
  if (credentials.connectionMode !== 'websocket') {
    log(
      'skip non-websocket binding appId=%s mode=%s',
      binding.applicationId,
      credentials.connectionMode,
    )
    return
  }

  const durationMs = options?.durationMs ?? DEFAULT_QQ_GATEWAY_DURATION_MS
  const abortSignal = options?.signal ?? new AbortController().signal
  const waitUntil =
    options?.waitUntil ??
    ((task: Promise<unknown>) => {
      void task
    })

  const adapter = createQQAdapter({
    appId: credentials.appId,
    clientSecret: credentials.appSecret,
  })

  // Lightweight Chat shell so adapter.initialize / logger work
  const chat = new Chat({
    adapters: { qq: adapter },
    concurrency: 'queue',
    state: createMemoryState(),
    userName: 'purechat-qq-gateway',
  })
  await chat.initialize()

  const webhookUrl = buildWebhookUrl(binding.applicationId)
  log(
    'starting gateway appId=%s webhook=%s durationMs=%d',
    binding.applicationId,
    webhookUrl,
    durationMs,
  )

  // startGatewayListener resolves on READY; keep the process alive for the window
  // so the WS stays up (adapter also auto-closes after durationMs).
  await adapter.startGatewayListener(
    { waitUntil },
    durationMs,
    abortSignal,
    webhookUrl,
    buildWebhookHeaders(),
  )

  await sleep(durationMs, abortSignal)

  const model = new ChannelBindingModel()
  await model.touchActive(binding.id)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

export async function runAllQQWebSocketGateways(options?: {
  durationMs?: number
  signal?: AbortSignal
}): Promise<{ started: number; skipped: number }> {
  const model = new ChannelBindingModel()
  const bindings = await model.findEnabledByPlatform(QQ_PLATFORM)

  let started = 0
  let skipped = 0

  await Promise.all(
    bindings.map(async (binding) => {
      let credentials: QQCredentials
      try {
        credentials = decryptCredentials(binding.credentials)
      } catch (error) {
        log('decrypt failed appId=%s: %O', binding.applicationId, error)
        skipped += 1
        return
      }

      if (credentials.connectionMode !== 'websocket') {
        skipped += 1
        return
      }

      started += 1
      try {
        await runQQGatewayForBinding(binding, options)
      } catch (error) {
        log('gateway failed appId=%s: %O', binding.applicationId, error)
      }
    }),
  )

  return { skipped, started }
}
