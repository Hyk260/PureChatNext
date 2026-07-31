import { createHash } from 'node:crypto'
import debug from 'debug'

import { getRedisConfig } from '@/envs/redis'
import { VERIFICATION_DAILY_IP_MAX, VERIFICATION_DAILY_IP_WINDOW_SECONDS } from '@/libs/better-auth/shared'
import { initializeRedis, isRedisEnabled, resetRedisClient } from '@/libs/redis'
import type { BaseRedisProvider } from '@/libs/redis'

const log = debug('auth:rate-limit')

type RateLimitRecord = {
  count: number
  key: string
  lastRequest: number
}

type RateLimitRule = {
  max: number
  window: number
}

type ConsumeResult = {
  allowed: boolean
  retryAfter: number | null
}

type ConsumeDecision = ConsumeResult & {
  next: RateLimitRecord
}

type StorageOptions = {
  /** 注入 Redis 客户端，主要用于测试；null 强制使用内存实现。 */
  redis?: BaseRedisProvider | null
}

/** Better Auth createRateLimitKey 中用于跨验证端点共享 IP 日限的后缀 */
const VERIFICATION_DAILY_RATE_LIMIT_PATH = '__verification_daily__'

/** 计入同一 IP 日限的验证类邮件发送端点 */
export const VERIFICATION_SEND_PATHS = new Set(['/send-verification-email', '/email-otp/send-verification-otp'])

const VERIFICATION_DAILY_IP_RATE_LIMIT: RateLimitRule = {
  max: VERIFICATION_DAILY_IP_MAX,
  window: VERIFICATION_DAILY_IP_WINDOW_SECONDS,
}

const memory = new Map<string, { data: RateLimitRecord; expiresAt: number }>()
const MEMORY_STORE_MAX_ENTRIES = 100_000
const MEMORY_PRUNE_INTERVAL_MS = 60_000
const REDIS_FAILURE_COOLDOWN_MS = 30_000
const REDIS_FAILURE_RETRY_AFTER_SECONDS = 60
const REDIS_KEY_PREFIX = 'better-auth:rate-limit:'

let nextMemoryPruneAt = 0

/**
 * 原子检查一个或两个滚动窗口桶；只有所有桶均允许时才同时递增。
 * KEYS 使用相同的 IP hash tag，兼容 Redis Cluster 的 EVAL 同槽要求。
 */
const CONSUME_LUA = `
local redisTime = redis.call('TIME')
local now = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
local bucketCount = tonumber(ARGV[1])
local decisions = {}

for i = 1, bucketCount do
  local max = tonumber(ARGV[1 + (i - 1) * 2 + 1])
  local windowSeconds = tonumber(ARGV[1 + (i - 1) * 2 + 2])
  local count = tonumber(redis.call('HGET', KEYS[i], 'count')) or 0
  local lastRequest = tonumber(redis.call('HGET', KEYS[i], 'lastRequest')) or 0

  if lastRequest == 0 or now - lastRequest >= windowSeconds * 1000 then
    count = 0
    lastRequest = now
  end

  if count >= max then
    local retryAfter = math.max(1, math.ceil((lastRequest + windowSeconds * 1000 - now) / 1000))
    return { 0, retryAfter }
  end

  decisions[i] = { count + 1, windowSeconds }
end

for i = 1, bucketCount do
  redis.call('HSET', KEYS[i], 'count', decisions[i][1], 'lastRequest', now)
  redis.call('EXPIRE', KEYS[i], decisions[i][2])
end

return { 1, 0 }
`

function getRetryAfter(lastRequest: number, window: number, now: number) {
  const windowInMs = window * 1000
  return Math.max(1, Math.ceil((lastRequest + windowInMs - now) / 1000))
}

function decideConsume(data: RateLimitRecord | undefined, rule: RateLimitRule, now: number): ConsumeDecision {
  const windowInMs = rule.window * 1000

  if (!data || now - data.lastRequest >= windowInMs) {
    return {
      allowed: true,
      next: { count: 1, key: data?.key ?? '', lastRequest: now },
      retryAfter: null,
    }
  }

  if (data.count >= rule.max) {
    return {
      allowed: false,
      next: data,
      retryAfter: getRetryAfter(data.lastRequest, rule.window, now),
    }
  }

  return {
    allowed: true,
    next: { ...data, count: data.count + 1, lastRequest: now },
    retryAfter: null,
  }
}

function maybePruneMemoryStore(now: number) {
  if (now < nextMemoryPruneAt) return
  nextMemoryPruneAt = now + MEMORY_PRUNE_INTERVAL_MS

  for (const [key, entry] of memory) {
    if (now >= entry.expiresAt) memory.delete(key)
  }
}

function readMemoryRecord(key: string, now: number): RateLimitRecord | undefined {
  const entry = memory.get(key)
  if (!entry || now >= entry.expiresAt) {
    if (entry) memory.delete(key)
    return undefined
  }
  return entry.data
}

function writeMemoryRecord(key: string, next: RateLimitRecord, windowSeconds: number, now: number) {
  if (!memory.has(key) && memory.size >= MEMORY_STORE_MAX_ENTRIES) return false

  memory.set(key, {
    data: { ...next, key },
    expiresAt: now + windowSeconds * 1000,
  })
  return true
}

function consumeMemory(key: string, rule: RateLimitRule): ConsumeResult {
  const now = Date.now()
  maybePruneMemoryStore(now)
  const decision = decideConsume(readMemoryRecord(key, now), rule, now)

  if (decision.allowed && !writeMemoryRecord(key, decision.next, rule.window, now)) {
    return { allowed: false, retryAfter: REDIS_FAILURE_RETRY_AFTER_SECONDS }
  }

  return { allowed: decision.allowed, retryAfter: decision.retryAfter }
}

function consumeVerificationMemory(
  key: string,
  parsed: { ip: string; path: string },
  rule: RateLimitRule
): ConsumeResult {
  const now = Date.now()
  maybePruneMemoryStore(now)
  const dailyKey = `${parsed.ip}|${VERIFICATION_DAILY_RATE_LIMIT_PATH}`
  const dailyDecision = decideConsume(readMemoryRecord(dailyKey, now), VERIFICATION_DAILY_IP_RATE_LIMIT, now)
  if (!dailyDecision.allowed) return { allowed: false, retryAfter: dailyDecision.retryAfter }

  const shortDecision = decideConsume(readMemoryRecord(key, now), rule, now)
  if (!shortDecision.allowed) return { allowed: false, retryAfter: shortDecision.retryAfter }

  if (memory.size + Number(!memory.has(dailyKey)) + Number(!memory.has(key)) > MEMORY_STORE_MAX_ENTRIES) {
    return { allowed: false, retryAfter: REDIS_FAILURE_RETRY_AFTER_SECONDS }
  }

  writeMemoryRecord(dailyKey, dailyDecision.next, VERIFICATION_DAILY_IP_RATE_LIMIT.window, now)
  writeMemoryRecord(key, shortDecision.next, rule.window, now)
  return { allowed: true, retryAfter: null }
}

function parseRateLimitKey(key: string): { ip: string; path: string } | null {
  const separatorIndex = key.indexOf('|')
  if (separatorIndex === -1) return null

  return {
    ip: key.slice(0, separatorIndex),
    path: key.slice(separatorIndex + 1),
  }
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function buildRedisKeys(key: string, parsed: { ip: string; path: string } | null) {
  if (!parsed) {
    const keyDigest = digest(key)
    return { shortKey: `${REDIS_KEY_PREFIX}{${keyDigest}}:short` }
  }

  const ipDigest = digest(parsed.ip)
  return {
    dailyKey: `${REDIS_KEY_PREFIX}{${ipDigest}}:daily`,
    shortKey: `${REDIS_KEY_PREFIX}{${ipDigest}}:short:${digest(parsed.path)}`,
  }
}

function parseRedisConsumeResult(value: unknown): ConsumeResult {
  if (!Array.isArray(value) || value.length < 2) throw new Error('Unexpected Redis rate-limit response')

  const allowed = Number(value[0]) === 1
  const retryAfter = Number(value[1])
  if (!Number.isFinite(retryAfter)) throw new Error('Unexpected Redis rate-limit retryAfter')

  return { allowed, retryAfter: allowed ? null : Math.max(1, retryAfter) }
}

/**
 * 在 Better Auth 默认短窗口限流之上，对验证类邮件端点追加同一 IP 的 24 小时滚动上限。
 * 配置 Redis 时使用 Lua 原子消费并跨实例共享；未配置 Redis 时使用单实例内存回退。
 */
export function createVerificationDailyRateLimitStorage(options: StorageOptions = {}) {
  const useInjectedRedis = Object.hasOwn(options, 'redis')
  const redisConfig = useInjectedRedis ? null : getRedisConfig()
  const useRedis = useInjectedRedis ? options.redis !== null : isRedisEnabled(redisConfig!)
  let redisUnavailableUntil = 0

  const getRedisClient = async () => {
    if (!useRedis || Date.now() < redisUnavailableUntil) return null
    if (useInjectedRedis) return options.redis ?? null
    return initializeRedis(redisConfig!)
  }

  const handleRedisFailure = async (error: unknown, verificationRequest: boolean) => {
    redisUnavailableUntil = Date.now() + REDIS_FAILURE_COOLDOWN_MS
    log('redis rate-limit unavailable: %O', error)
    if (!useInjectedRedis)
      await resetRedisClient().catch((resetError) => log('failed to reset redis client: %O', resetError))
    return verificationRequest ? { allowed: false, retryAfter: REDIS_FAILURE_RETRY_AFTER_SECONDS } : null
  }

  return {
    async get(key: string) {
      const parsed = parseRateLimitKey(key)
      const redis = await getRedisClient().catch(async (error) => {
        await handleRedisFailure(error, false)
        return null
      })
      if (!redis) {
        const now = Date.now()
        return readMemoryRecord(key, now) ?? null
      }

      try {
        const redisKey =
          parsed?.path === VERIFICATION_DAILY_RATE_LIMIT_PATH
            ? buildRedisKeys(key, parsed).dailyKey
            : buildRedisKeys(key, parsed).shortKey
        if (!redisKey) return null
        const data = await redis.hgetall(redisKey)
        if (!data.count || !data.lastRequest) return null
        return { count: Number(data.count), key, lastRequest: Number(data.lastRequest) }
      } catch (error) {
        await handleRedisFailure(error, false)
        return null
      }
    },
    async set(key: string, value: RateLimitRecord) {
      const parsed = parseRateLimitKey(key)
      const redis = await getRedisClient().catch(async (error) => {
        await handleRedisFailure(error, false)
        return null
      })
      // Better Auth 1.6.22 在提供 consume 时不会调用 legacy set；保留方法仅用于接口兼容。
      const ttlSeconds = VERIFICATION_DAILY_IP_WINDOW_SECONDS

      if (!redis) {
        writeMemoryRecord(key, value, ttlSeconds, Date.now())
        return
      }

      try {
        const redisKey =
          parsed?.path === VERIFICATION_DAILY_RATE_LIMIT_PATH
            ? buildRedisKeys(key, parsed).dailyKey
            : buildRedisKeys(key, parsed).shortKey
        if (!redisKey) return
        const result = await redis
          .pipeline()
          .hset(redisKey, 'count', value.count)
          .hset(redisKey, 'lastRequest', value.lastRequest)
          .expire(redisKey, ttlSeconds)
          .exec()
        if (result?.some(([error]) => error)) throw new Error('Redis rate-limit pipeline failed')
      } catch (error) {
        await handleRedisFailure(error, false)
      }
    },
    async consume(key: string, rule: RateLimitRule): Promise<ConsumeResult> {
      const parsed = parseRateLimitKey(key)
      const verificationRequest = Boolean(parsed && VERIFICATION_SEND_PATHS.has(parsed.path))
      const redis = await getRedisClient().catch(async (error) => {
        await handleRedisFailure(error, verificationRequest)
        return null
      })

      if (!redis) {
        if (useRedis && verificationRequest) {
          return { allowed: false, retryAfter: REDIS_FAILURE_RETRY_AFTER_SECONDS }
        }
        return verificationRequest && parsed ? consumeVerificationMemory(key, parsed, rule) : consumeMemory(key, rule)
      }

      try {
        const keys = buildRedisKeys(key, parsed)
        const args: Array<string | number> = []
        let redisKeys: string[]

        if (verificationRequest && keys.dailyKey) {
          redisKeys = [keys.dailyKey, keys.shortKey]
          args.push(
            2,
            VERIFICATION_DAILY_IP_RATE_LIMIT.max,
            VERIFICATION_DAILY_IP_RATE_LIMIT.window,
            rule.max,
            rule.window
          )
        } else {
          redisKeys = [keys.shortKey]
          args.push(1, rule.max, rule.window)
        }

        const result = await redis.eval(CONSUME_LUA, redisKeys.length, ...redisKeys, ...args)
        return parseRedisConsumeResult(result)
      } catch (error) {
        const failure = await handleRedisFailure(error, verificationRequest)
        if (failure) return failure
        return consumeMemory(key, rule)
      }
    },
  }
}

/** @internal test helper */
export function resetVerificationRateLimitMemoryForTests() {
  memory.clear()
  nextMemoryPruneAt = 0
}
