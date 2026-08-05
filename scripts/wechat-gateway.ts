/** 本地 / 自托管微信 iLink 常驻 Gateway。 */
import 'dotenv/config'

import { stat, writeFile } from 'node:fs/promises'

const LOOP_GAP_MS = 2_000
const POLL_WINDOW_MS = 60_000
const HEALTH_INTERVAL_MS = 5_000
const HEALTH_MAX_AGE_MS = 20_000
const HEALTH_FILE = process.env.WECHAT_GATEWAY_HEALTH_FILE || '/tmp/purechat-wechat-gateway.heartbeat'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function healthcheck() {
  try {
    const info = await stat(HEALTH_FILE)
    if (Date.now() - info.mtimeMs > HEALTH_MAX_AGE_MS) process.exit(1)
  } catch {
    process.exit(1)
  }
}

async function migrateLegacyCredentials(
  model: InstanceType<(typeof import('@pure/database/models/channelBinding'))['ChannelBindingModel']>,
  crypto: Pick<
    typeof import('../src/libs/channels/wechat'),
    'credentialsNeedMigration' | 'decryptCredentials' | 'encryptCredentials'
  >,
  platform: string
) {
  const bindings = await model.findEnabledByPlatform(platform)
  for (const binding of bindings) {
    if (!crypto.credentialsNeedMigration(binding.credentials)) continue
    try {
      await model.updateCredentials(
        binding.id,
        crypto.encryptCredentials(crypto.decryptCredentials(binding.credentials))
      )
      console.log(`[wechat-gateway] re-encrypted legacy credentials binding=${binding.id}`)
    } catch {
      await model.markNeedsRebind(binding.id)
      console.error(`[wechat-gateway] invalid legacy credentials binding=${binding.id}; rebind required`)
    }
  }
}

async function main() {
  const [{ ChannelBindingModel, WECHAT_PLATFORM }, { ChannelEventModel }, wechat] = await Promise.all([
    import('@pure/database/models/channelBinding'),
    import('@pure/database/models/channelEvent'),
    import('../src/libs/channels/wechat'),
  ])
  wechat.requireWechatVaultSecret()
  const bindingModel = new ChannelBindingModel()
  const eventModel = new ChannelEventModel()
  await migrateLegacyCredentials(bindingModel, wechat, WECHAT_PLATFORM)

  const abortController = new AbortController()
  const runningPolls = new Map<string, Promise<unknown>>()
  const stop = () => abortController.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  await writeFile(HEALTH_FILE, new Date().toISOString())
  const heartbeat = setInterval(() => {
    void writeFile(HEALTH_FILE, new Date().toISOString())
  }, HEALTH_INTERVAL_MS)

  const processors = Array.from({ length: 4 }, () => wechat.runWechatProcessor(abortController.signal))
  console.log('[wechat-gateway] durable poller and processors started')
  let lastPruneAt = 0

  try {
    while (!abortController.signal.aborted) {
      if (Date.now() - lastPruneAt > 24 * 60 * 60_000) {
        await eventModel.pruneCompleted(new Date(Date.now() - 30 * 24 * 60 * 60_000))
        lastPruneAt = Date.now()
      }
      const bindings = await bindingModel.findEnabledByPlatform(WECHAT_PLATFORM)
      for (const binding of bindings) {
        if (runningPolls.has(binding.id)) continue
        const task = wechat.pollBinding(binding, {
          durationMs: POLL_WINDOW_MS,
          owner: `gateway-${process.pid}-${binding.id}`,
          signal: abortController.signal,
        })
          .catch((error) => console.error(`[wechat-gateway] poll failed binding=${binding.id}`, error))
          .finally(() => runningPolls.delete(binding.id))
        runningPolls.set(binding.id, task)
      }
      await sleep(LOOP_GAP_MS)
    }
  } finally {
    clearInterval(heartbeat)
    await Promise.allSettled([...runningPolls.values(), ...processors])
  }
}

if (process.argv.includes('--healthcheck')) {
  await healthcheck()
} else {
  main().catch((error) => {
    console.error('[wechat-gateway] fatal:', error instanceof Error ? error.message : 'unknown error')
    process.exit(1)
  })
}
