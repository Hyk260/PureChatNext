/** 本地 / 自托管微信 iLink 常驻 Gateway。 */
import 'dotenv/config'

import { stat, writeFile } from 'node:fs/promises'
import { appEnv } from '@/envs/app'
import { fileEnv } from '@/envs/file'

const LOOP_GAP_MS = 2_000
const POLL_WINDOW_MS = 60_000
const HEALTH_INTERVAL_MS = 5_000
const HEALTH_MAX_AGE_MS = 20_000
const SUMMARY_INTERVAL_MS = 60_000
const PROCESSOR_COUNT = 4
const SINGLETON_LOCK_NAME = 'purechat:wechat-gateway'
const FOREIGN_LEASE_WAIT_MS = 95_000
const HEALTH_FILE = appEnv.WECHAT_GATEWAY_HEALTH_FILE || '/tmp/purechat-wechat-gateway.heartbeat'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class DuplicateGatewayError extends Error {
  constructor(detail?: string) {
    super(`检测到另一个微信 Gateway 实例正在运行，请先停止现有实例。${detail ? ` ${detail}` : ''}`)
    this.name = 'DuplicateGatewayError'
  }
}

async function acquireSingletonLock() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('未配置 DATABASE_URL，无法启动微信 Gateway。')
  const { default: postgres } = await import('postgres')
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: process.env.DATABASE_DRIVER === 'neon' ? 'require' : false,
  })
  const connection = await sql.reserve()
  const rows = await connection`select pg_try_advisory_lock(hashtextextended(${SINGLETON_LOCK_NAME}, 0)) as acquired`
  if (!(rows[0] as { acquired?: boolean } | undefined)?.acquired) {
    connection.release()
    await sql.end({ timeout: 5 })
    throw new DuplicateGatewayError()
  }

  return async () => {
    try {
      await connection`select pg_advisory_unlock(hashtextextended(${SINGLETON_LOCK_NAME}, 0))`
    } finally {
      connection.release()
      await sql.end({ timeout: 5 })
    }
  }
}

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
      console.log(`[微信 Gateway] 已重新加密历史凭证：绑定=${binding.id}`)
    } catch {
      await model.markNeedsRebind(binding.id)
      console.error(`[微信 Gateway] 历史凭证无效，需要重新扫码：绑定=${binding.id}`)
    }
  }
}

async function waitForForeignBindingLeases(
  model: InstanceType<(typeof import('@pure/database/models/channelBinding'))['ChannelBindingModel']>,
  platform: string
) {
  const deadline = Date.now() + FOREIGN_LEASE_WAIT_MS
  let lastNoticeAt = 0

  for (;;) {
    const bindings = await model.findEnabledByPlatform(platform)
    const now = Date.now()
    const foreignLease = bindings.find(
      (binding) =>
        binding.pollLeaseOwner &&
        binding.pollLeaseExpiresAt &&
        binding.pollLeaseExpiresAt.getTime() > now &&
        !binding.pollLeaseOwner.startsWith(`gateway-${process.pid}-`)
    )
    if (!foreignLease) return

    if (now >= deadline) {
      throw new DuplicateGatewayError(
        `绑定=${foreignLease.id}，租约持有者=${foreignLease.pollLeaseOwner}，租约仍在续期。`
      )
    }

    if (now - lastNoticeAt >= 10_000) {
      const remainingSeconds = Math.max(1, Math.ceil((foreignLease.pollLeaseExpiresAt!.getTime() - now) / 1000))
      console.warn(
        `[微信 Gateway] 发现其他实例的绑定租约：${foreignLease.id}，等待自动释放，预计不超过 ${remainingSeconds} 秒`
      )
      lastNoticeAt = now
    }
    await sleep(Math.min(5000, Math.max(500, foreignLease.pollLeaseExpiresAt!.getTime() - now + 100)))
  }
}

async function main() {
  console.log(`[微信 Gateway] 正在启动：PID=${process.pid}，Processor=${PROCESSOR_COUNT}`)
  const releaseSingletonLock = await acquireSingletonLock()
  console.log('[微信 Gateway] 单实例锁获取成功，数据库连接正常')
  if (!(fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_ENDPOINT && fileEnv.S3_BUCKET)) {
    console.warn('[微信 Gateway] S3 未完整配置：文本消息可用，但文件长期保存、Excel 编辑和文件回传将不可用')
  }

  try {
    const [{ ChannelBindingModel, WECHAT_PLATFORM }, { ChannelEventModel }, { ChannelEventFileModel }, wechat] = await Promise.all([
      import('@pure/database/models/channelBinding'),
      import('@pure/database/models/channelEvent'),
      import('@pure/database/models/channelEventFile'),
      import('../src/libs/channels/wechat'),
    ])
    wechat.requireWechatVaultSecret()
    const bindingModel = new ChannelBindingModel()
    const eventModel = new ChannelEventModel()
    await new ChannelEventFileModel().assertReady()
    await waitForForeignBindingLeases(bindingModel, WECHAT_PLATFORM)
    await migrateLegacyCredentials(bindingModel, wechat, WECHAT_PLATFORM)

    const abortController = new AbortController()
    const runningPolls = new Map<string, Promise<unknown>>()
    const bindingStatuses = new Map<string, string>()
    let stopping = false
    let processedSinceSummary = 0
    let lastBindingCount = -1
    let lastSummaryAt = 0
    let lastSummarySnapshot = ''
    const stop = () => {
      if (stopping) return
      stopping = true
      console.log('[微信 Gateway] 收到停止信号，正在释放轮询租约和处理器')
      abortController.abort()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    process.once('SIGHUP', stop)

    await writeFile(HEALTH_FILE, new Date().toISOString())
    const heartbeat = setInterval(() => {
      void writeFile(HEALTH_FILE, new Date().toISOString())
    }, HEALTH_INTERVAL_MS)

    const processors = Array.from({ length: PROCESSOR_COUNT }, () =>
      wechat.runWechatProcessor(abortController.signal, () => {
        processedSinceSummary += 1
      })
    )
    console.log(
      `[微信 Gateway] 持久轮询和消息处理器已启动；消息正文日志=${appEnv.WECHAT_GATEWAY_LOG_MESSAGE_TEXT ? '开启（最多 200 字）' : '关闭'}`
    )
    let lastPruneAt = 0

    try {
      while (!abortController.signal.aborted) {
        if (Date.now() - lastPruneAt > 24 * 60 * 60_000) {
          await eventModel.pruneCompleted(new Date(Date.now() - 30 * 24 * 60 * 60_000))
          lastPruneAt = Date.now()
        }
        const bindings = await bindingModel.findEnabledByPlatform(WECHAT_PLATFORM)
        if (bindings.length !== lastBindingCount) {
          console.log(`[微信 Gateway] 当前启用的微信绑定：${bindings.length} 个`)
          lastBindingCount = bindings.length
        }
        for (const binding of bindings) {
          if (runningPolls.has(binding.id)) continue
          if (!bindingStatuses.has(binding.id)) {
            console.log(`[微信 Gateway] 正在协调绑定：${binding.id}`)
          }
          const task = wechat
            .pollBinding(binding, {
              durationMs: POLL_WINDOW_MS,
              owner: `gateway-${process.pid}-${binding.id}`,
              signal: abortController.signal,
              onStatus: ({ bindingId, code, status }) => {
                const previous = bindingStatuses.get(bindingId)
                if (status === 'lease_acquired') {
                  if (!previous) bindingStatuses.set(bindingId, status)
                  return
                }
                if (status === 'online' && previous !== 'online') {
                  console.log(`[微信 Gateway] 绑定已上线，轮询心跳正常：${bindingId}`)
                } else if (status === 'degraded' && previous !== `degraded:${code}`) {
                  console.warn(`[微信 Gateway] 绑定轮询异常：${bindingId}，错误码=${code || '未知'}`)
                } else if (status === 'needs_rebind' && previous !== 'needs_rebind') {
                  console.warn(`[微信 Gateway] 绑定凭证已失效，需要重新扫码：${bindingId}`)
                } else if (status === 'lease_skipped' && previous !== 'lease_skipped') {
                  console.warn(`[微信 Gateway] 绑定已被其他实例租用，跳过轮询：${bindingId}`)
                }
                bindingStatuses.set(bindingId, status === 'degraded' ? `degraded:${code}` : status)
              },
            })
            .catch((error) =>
              console.error(
                `[微信 Gateway] 绑定轮询任务异常退出：${binding.id}，原因=${error instanceof Error ? error.message : '未知错误'}`
              )
            )
            .finally(() => runningPolls.delete(binding.id))
          runningPolls.set(binding.id, task)
        }

        if (Date.now() - lastSummaryAt >= SUMMARY_INTERVAL_MS) {
          const queue = await eventModel.getQueueCounts()
          const statusCounts = bindings.reduce<Record<string, number>>((counts, binding) => {
            const heartbeatFresh = binding.lastHeartbeatAt && Date.now() - binding.lastHeartbeatAt.getTime() <= 90_000
            const status = binding.needsRebind ? 'needs_rebind' : !heartbeatFresh ? 'offline' : binding.runtimeStatus
            counts[status] = (counts[status] ?? 0) + 1
            return counts
          }, {})
          const snapshot = [
            statusCounts.online ?? 0,
            statusCounts.degraded ?? 0,
            statusCounts.offline ?? 0,
            statusCounts.needs_rebind ?? 0,
            queue.processing,
            queue.pending,
            queue.retry,
            queue.failed,
          ].join('|')
          if (snapshot !== lastSummarySnapshot || processedSinceSummary > 0) {
            console.log(
              `[微信 Gateway] 运行摘要：在线=${statusCounts.online ?? 0}，异常=${statusCounts.degraded ?? 0}，离线=${statusCounts.offline ?? 0}，需重绑=${statusCounts.needs_rebind ?? 0}，处理中=${queue.processing}，待处理=${queue.pending}，重试=${queue.retry}，失败=${queue.failed}，本周期处理=${processedSinceSummary}`
            )
            lastSummarySnapshot = snapshot
          }
          processedSinceSummary = 0
          lastSummaryAt = Date.now()
        }
        await sleep(LOOP_GAP_MS)
      }
    } finally {
      clearInterval(heartbeat)
      await Promise.allSettled([...runningPolls.values(), ...processors])
    }
  } finally {
    await releaseSingletonLock()
    console.log('[微信 Gateway] 已停止，单实例锁已释放')
  }
}

if (process.argv.includes('--healthcheck')) {
  await healthcheck()
} else {
  void main()
    .then(() => process.exit(0))
    .catch((error) => {
      const message = error instanceof Error ? error.message : '未知错误'
      console.error(`[微信 Gateway] 启动失败：${message}`)
      process.exit(error instanceof DuplicateGatewayError ? 2 : 1)
    })
}
