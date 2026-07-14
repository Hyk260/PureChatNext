import { getRedisConfig } from '@/envs/redis'
import { initializeRedis, isRedisEnabled } from '@/libs/redis'

/**
 * Build Better Auth secondaryStorage backed by Redis.
 * Uses the shared Redis manager to avoid duplicate connections and prefixes keys to prevent clashes.
 *
 * Returns `undefined` when Redis is disabled / not configured so Better Auth falls back to DB.
 */
export const createSecondaryStorage = () => {
  const redisConfig = getRedisConfig()
  if (!isRedisEnabled(redisConfig)) return undefined

  const secondaryStorageKeyPrefix = 'better-auth:'

  const buildKey = (key: string) => `${secondaryStorageKeyPrefix}${key}`

  const getRedisClient = async () => {
    const redisClient = await initializeRedis(redisConfig)
    if (!redisClient) {
      throw new Error('Redis secondary storage is enabled but failed to initialize')
    }

    return redisClient
  }

  return {
    delete: async (key: string) => {
      const redisClient = await getRedisClient()
      await redisClient.del(buildKey(key))
    },
    get: async (key: string) => {
      const redisClient = await getRedisClient()
      return (await redisClient.get(buildKey(key))) ?? null
    },
    set: async (key: string, value: string, ttl?: number) => {
      const redisClient = await getRedisClient()
      if (typeof ttl === 'number') {
        await redisClient.set(buildKey(key), value, { ex: ttl })
        return
      }

      await redisClient.set(buildKey(key), value)
    },
  }
}
