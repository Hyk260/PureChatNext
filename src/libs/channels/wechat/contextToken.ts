import { getRedisConfig } from '@/envs/redis'
import { initializeRedis, RedisKeys } from '@/libs/redis'
import { type BaseRedisProvider } from '@/libs/redis/types'

const CONTEXT_TOKEN_TTL_SEC = 24 * 60 * 60

/** In-memory fallback when Redis is unavailable (local gateway). */
const memoryTokens = new Map<string, { expiresAt: number; token: string }>()

async function getWechatRedis(): Promise<BaseRedisProvider | null> {
  return initializeRedis(getRedisConfig())
}

function memoryKey(bindingId: string, fromUserId: string) {
  return `${bindingId}:${fromUserId}`
}

export async function setContextToken(bindingId: string, fromUserId: string, contextToken: string): Promise<void> {
  const key = RedisKeys.wechat.contextToken(bindingId, fromUserId)
  const redis = await getWechatRedis()

  if (redis) {
    await redis.setex(key, CONTEXT_TOKEN_TTL_SEC, contextToken)
    return
  }

  memoryTokens.set(memoryKey(bindingId, fromUserId), {
    expiresAt: Date.now() + CONTEXT_TOKEN_TTL_SEC * 1000,
    token: contextToken,
  })
}

export async function getContextToken(bindingId: string, fromUserId: string): Promise<string | null> {
  const key = RedisKeys.wechat.contextToken(bindingId, fromUserId)
  const redis = await getWechatRedis()

  if (redis) {
    return redis.get(key)
  }

  const entry = memoryTokens.get(memoryKey(bindingId, fromUserId))
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    memoryTokens.delete(memoryKey(bindingId, fromUserId))
    return null
  }
  return entry.token
}
