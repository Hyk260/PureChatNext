import debug from 'debug'

import { getRedisConfig } from '@/envs/redis'
import { initializeRedis, isRedisEnabled, resetRedisClient } from '@/libs/redis'
import type { BaseRedisProvider } from '@/libs/redis'

const log = debug('auth:session')

/** Redis 失败后冷却时间：期间跳过 Redis，直接让 Better Auth 走 DB，避免每次请求卡满 connectTimeout */
const FAILURE_COOLDOWN_MS = 30_000

/**
 * Build Better Auth secondaryStorage backed by Redis.
 * Uses the shared Redis manager to avoid duplicate connections and prefixes keys to prevent clashes.
 *
 * Returns `undefined` when Redis is disabled / not configured so Better Auth falls back to DB.
 *
 * Redis 不可用时（连接/命令超时等）自动降级：
 * - get → 返回 null，配合 `storeSessionInDatabase: true` 从数据库恢复会话
 * - set / delete → 忽略错误（best-effort）
 * - 打开短时熔断，避免连续请求各自卡 10s
 */
export const createSecondaryStorage = () => {
  const redisConfig = getRedisConfig()
  if (!isRedisEnabled(redisConfig)) return undefined

  const secondaryStorageKeyPrefix = 'better-auth:'
  const buildKey = (key: string) => `${secondaryStorageKeyPrefix}${key}`

  let unavailableUntil = 0

  const isCircuitOpen = () => Date.now() < unavailableUntil

  const markUnavailable = (error: unknown) => {
    unavailableUntil = Date.now() + FAILURE_COOLDOWN_MS
    log('redis secondary storage unavailable for %dms, falling back to DB: %O', FAILURE_COOLDOWN_MS, error)
    void resetRedisClient().catch((resetError) => {
      log('failed to reset redis client after secondary storage error: %O', resetError)
    })
  }

  const getRedisClient = async (): Promise<BaseRedisProvider | null> => {
    if (isCircuitOpen()) return null

    try {
      const redisClient = await initializeRedis(redisConfig)
      if (!redisClient) {
        markUnavailable(new Error('Redis secondary storage enabled but client is null'))
        return null
      }
      return redisClient
    } catch (error) {
      markUnavailable(error)
      return null
    }
  }

  const run = async <T>(op: (client: BaseRedisProvider) => Promise<T>, fallback: T): Promise<T> => {
    const redisClient = await getRedisClient()
    if (!redisClient) return fallback

    try {
      return await op(redisClient)
    } catch (error) {
      markUnavailable(error)
      return fallback
    }
  }

  return {
    delete: async (key: string) => {
      await run(async (client) => {
        await client.del(buildKey(key))
      }, undefined)
    },
    get: async (key: string) => {
      return run(async (client) => (await client.get(buildKey(key))) ?? null, null)
    },
    set: async (key: string, value: string, ttl?: number) => {
      await run(async (client) => {
        if (typeof ttl === 'number') {
          await client.set(buildKey(key), value, { ex: ttl })
          return
        }
        await client.set(buildKey(key), value)
      }, undefined)
    },
  }
}
