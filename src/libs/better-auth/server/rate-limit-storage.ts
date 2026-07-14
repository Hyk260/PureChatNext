import {
  VERIFICATION_DAILY_IP_MAX,
  VERIFICATION_DAILY_IP_WINDOW_SECONDS,
} from '@/libs/better-auth/constants'

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

/** Better Auth createRateLimitKey 中用于跨验证端点共享 IP 日限的后缀 */
const VERIFICATION_DAILY_RATE_LIMIT_PATH = '__verification_daily__'

/** 计入同一 IP 日限的验证类邮件发送端点 */
export const VERIFICATION_SEND_PATHS = new Set([
  '/send-verification-email',
  '/email-otp/send-verification-otp',
])

const VERIFICATION_DAILY_IP_RATE_LIMIT: RateLimitRule = {
  max: VERIFICATION_DAILY_IP_MAX,
  window: VERIFICATION_DAILY_IP_WINDOW_SECONDS,
}

const memory = new Map<string, { data: RateLimitRecord; expiresAt: number }>()
const MEMORY_STORE_MAX_ENTRIES = 100_000

function getRetryAfter(lastRequest: number, window: number) {
  const windowInMs = window * 1000
  return Math.ceil((lastRequest + windowInMs - Date.now()) / 1000)
}

function decideConsume(
  data: RateLimitRecord | undefined,
  rule: RateLimitRule,
  now: number,
): { allowed: boolean; next: RateLimitRecord; retryAfter: number | null; update: boolean } {
  const windowInMs = rule.window * 1000

  if (!data) {
    return {
      allowed: true,
      next: { count: 1, key: '', lastRequest: now },
      retryAfter: null,
      update: false,
    }
  }

  if (now - data.lastRequest > windowInMs) {
    return {
      allowed: true,
      next: { ...data, count: 1, lastRequest: now },
      retryAfter: null,
      update: true,
    }
  }

  if (data.count >= rule.max) {
    return {
      allowed: false,
      next: data,
      retryAfter: getRetryAfter(data.lastRequest, rule.window),
      update: true,
    }
  }

  return {
    allowed: true,
    next: { ...data, count: data.count + 1, lastRequest: now },
    retryAfter: null,
    update: true,
  }
}

function pruneMemoryStore() {
  const now = Date.now()

  for (const [key, entry] of memory) {
    if (now >= entry.expiresAt) {
      memory.delete(key)
    }
  }

  if (memory.size <= MEMORY_STORE_MAX_ENTRIES) return

  const overflow = memory.size - MEMORY_STORE_MAX_ENTRIES
  let removed = 0

  for (const key of memory.keys()) {
    memory.delete(key)
    if (++removed >= overflow) break
  }
}

function consumeMemory(key: string, rule: RateLimitRule): ConsumeResult {
  pruneMemoryStore()

  const now = Date.now()
  const entry = memory.get(key)
  const decision = decideConsume(entry && now < entry.expiresAt ? entry.data : undefined, rule, now)

  if (decision.allowed) {
    memory.set(key, {
      data: { ...decision.next, key },
      expiresAt: now + rule.window * 1000,
    })
  }

  return {
    allowed: decision.allowed,
    retryAfter: decision.retryAfter,
  }
}

function parseRateLimitKey(key: string): { ip: string; path: string } | null {
  const separatorIndex = key.indexOf('|')
  if (separatorIndex === -1) return null

  return {
    ip: key.slice(0, separatorIndex),
    path: key.slice(separatorIndex + 1),
  }
}

/**
 * 在 Better Auth 默认内存限流之上，对验证类邮件端点追加同一 IP 的日发送上限。
 * 短窗口规则仍由 rateLimit.customRules 控制。
 */
export function createVerificationDailyRateLimitStorage() {
  return {
    async get(key: string) {
      const entry = memory.get(key)
      if (!entry || Date.now() >= entry.expiresAt) {
        if (entry) memory.delete(key)
        return null
      }

      return entry.data
    },
    async set(key: string, value: RateLimitRecord, update?: boolean) {
      const ttlSeconds = VERIFICATION_DAILY_IP_WINDOW_SECONDS
      memory.set(key, {
        data: update ? value : { ...value, key },
        expiresAt: Date.now() + ttlSeconds * 1000,
      })
    },
    async consume(key: string, rule: RateLimitRule): Promise<ConsumeResult> {
      const parsed = parseRateLimitKey(key)

      if (parsed && VERIFICATION_SEND_PATHS.has(parsed.path)) {
        const dailyKey = `${parsed.ip}|${VERIFICATION_DAILY_RATE_LIMIT_PATH}`
        const dailyResult = consumeMemory(dailyKey, VERIFICATION_DAILY_IP_RATE_LIMIT)
        if (!dailyResult.allowed) {
          return dailyResult
        }
      }

      return consumeMemory(key, rule)
    },
  }
}
