import { VERIFICATION_DAILY_IP_MAX, VERIFICATION_DAILY_IP_WINDOW_SECONDS } from '@/libs/better-auth/shared'

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

type ConsumeDecision = {
  allowed: boolean
  next: RateLimitRecord
  retryAfter: number | null
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

function getRetryAfter(lastRequest: number, window: number) {
  const windowInMs = window * 1000
  return Math.ceil((lastRequest + windowInMs - Date.now()) / 1000)
}

function decideConsume(data: RateLimitRecord | undefined, rule: RateLimitRule, now: number): ConsumeDecision {
  const windowInMs = rule.window * 1000

  if (!data) {
    return {
      allowed: true,
      next: { count: 1, key: '', lastRequest: now },
      retryAfter: null,
    }
  }

  if (now - data.lastRequest > windowInMs) {
    return {
      allowed: true,
      next: { ...data, count: 1, lastRequest: now },
      retryAfter: null,
    }
  }

  if (data.count >= rule.max) {
    return {
      allowed: false,
      next: data,
      retryAfter: getRetryAfter(data.lastRequest, rule.window),
    }
  }

  return {
    allowed: true,
    next: { ...data, count: data.count + 1, lastRequest: now },
    retryAfter: null,
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

function readRecord(key: string, now: number): RateLimitRecord | undefined {
  const entry = memory.get(key)
  if (!entry || now >= entry.expiresAt) return undefined
  return entry.data
}

function writeRecord(key: string, next: RateLimitRecord, windowSeconds: number, now: number) {
  memory.set(key, {
    data: { ...next, key },
    expiresAt: now + windowSeconds * 1000,
  })
}

function consumeMemory(key: string, rule: RateLimitRule): ConsumeResult {
  pruneMemoryStore()

  const now = Date.now()
  const decision = decideConsume(readRecord(key, now), rule, now)

  if (decision.allowed) {
    writeRecord(key, decision.next, rule.window, now)
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
 *
 * 验证类路径会先只读判定日限与短窗口，两者都允许后才一并写入，避免短窗口 429 时误耗日配额。
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

      if (!parsed || !VERIFICATION_SEND_PATHS.has(parsed.path)) {
        return consumeMemory(key, rule)
      }

      pruneMemoryStore()

      const now = Date.now()
      const dailyKey = `${parsed.ip}|${VERIFICATION_DAILY_RATE_LIMIT_PATH}`

      const dailyDecision = decideConsume(readRecord(dailyKey, now), VERIFICATION_DAILY_IP_RATE_LIMIT, now)
      if (!dailyDecision.allowed) {
        return {
          allowed: false,
          retryAfter: dailyDecision.retryAfter,
        }
      }

      const shortDecision = decideConsume(readRecord(key, now), rule, now)
      if (!shortDecision.allowed) {
        return {
          allowed: false,
          retryAfter: shortDecision.retryAfter,
        }
      }

      writeRecord(dailyKey, dailyDecision.next, VERIFICATION_DAILY_IP_RATE_LIMIT.window, now)
      writeRecord(key, shortDecision.next, rule.window, now)

      return { allowed: true, retryAfter: null }
    },
  }
}

/** @internal test helper */
export function resetVerificationRateLimitMemoryForTests() {
  memory.clear()
}
