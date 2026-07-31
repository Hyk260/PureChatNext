import { afterEach, describe, expect, it, vi } from 'vitest'

import { VERIFICATION_DAILY_IP_MAX } from '@/libs/better-auth/shared'

import { createVerificationDailyRateLimitStorage, resetVerificationRateLimitMemoryForTests } from './rate-limit-storage'

const SHORT_RULE = { max: 1, window: 60 }

describe('createVerificationDailyRateLimitStorage', () => {
  afterEach(() => {
    resetVerificationRateLimitMemoryForTests()
  })

  it('does not consume daily quota when short-window rejects', async () => {
    const storage = createVerificationDailyRateLimitStorage({ redis: null })
    const key = '1.2.3.4|/send-verification-email'

    await expect(storage.consume(key, SHORT_RULE)).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    })

    // Within short window — should reject without burning daily count
    for (let i = 0; i < VERIFICATION_DAILY_IP_MAX; i++) {
      await expect(storage.consume(key, SHORT_RULE)).resolves.toMatchObject({
        allowed: false,
      })
    }

    const daily = await storage.get('1.2.3.4|__verification_daily__')
    expect(daily?.count).toBe(1)
  })

  it('allows another path under the same IP daily budget after a successful send', async () => {
    const storage = createVerificationDailyRateLimitStorage({ redis: null })

    await expect(storage.consume('1.2.3.4|/send-verification-email', SHORT_RULE)).resolves.toMatchObject({
      allowed: true,
    })

    await expect(storage.consume('1.2.3.4|/email-otp/send-verification-otp', SHORT_RULE)).resolves.toMatchObject({
      allowed: true,
    })

    const daily = await storage.get('1.2.3.4|__verification_daily__')
    expect(daily?.count).toBe(2)
  })

  it('rejects when daily quota is exhausted', async () => {
    const storage = createVerificationDailyRateLimitStorage({ redis: null })
    const ip = '8.8.8.8'

    await storage.set(`${ip}|__verification_daily__`, {
      count: VERIFICATION_DAILY_IP_MAX,
      key: `${ip}|__verification_daily__`,
      lastRequest: Date.now(),
    })

    await expect(storage.consume(`${ip}|/send-verification-email`, SHORT_RULE)).resolves.toMatchObject({
      allowed: false,
    })
  })

  it('atomically consumes the daily and short Redis buckets', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue([1, 0]),
    }
    const storage = createVerificationDailyRateLimitStorage({ redis: redis as never })

    await expect(storage.consume('1.2.3.4|/send-verification-email', SHORT_RULE)).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    })

    expect(redis.eval).toHaveBeenCalledTimes(1)
    const [, keyCount, dailyKey, shortKey, bucketCount, dailyMax, dailyWindow, shortMax, shortWindow] =
      redis.eval.mock.calls[0]
    expect(keyCount).toBe(2)
    expect(dailyKey).toContain('better-auth:rate-limit:{')
    expect(shortKey).toContain('better-auth:rate-limit:{')
    expect(dailyKey.match(/\{[^}]+\}/)?.[0]).toBe(shortKey.match(/\{[^}]+\}/)?.[0])
    expect(bucketCount).toBe(2)
    expect(dailyMax).toBe(VERIFICATION_DAILY_IP_MAX)
    expect(dailyWindow).toBe(86_400)
    expect(shortMax).toBe(SHORT_RULE.max)
    expect(shortWindow).toBe(SHORT_RULE.window)
  })

  it('fails closed for verification email when Redis is unavailable', async () => {
    const redis = {
      eval: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    }
    const storage = createVerificationDailyRateLimitStorage({ redis: redis as never })

    await expect(storage.consume('1.2.3.4|/send-verification-email', SHORT_RULE)).resolves.toEqual({
      allowed: false,
      retryAfter: 60,
    })
  })

  it('falls back to local short-window limiting for ordinary auth paths when Redis is unavailable', async () => {
    const redis = {
      eval: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    }
    const storage = createVerificationDailyRateLimitStorage({ redis: redis as never })
    const key = '1.2.3.4|/sign-in/email'

    await expect(storage.consume(key, SHORT_RULE)).resolves.toMatchObject({ allowed: true })
    await expect(storage.consume(key, SHORT_RULE)).resolves.toMatchObject({ allowed: false })
  })
})
