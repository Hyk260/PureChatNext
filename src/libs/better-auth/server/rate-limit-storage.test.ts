import { afterEach, describe, expect, it } from 'vitest'

import { VERIFICATION_DAILY_IP_MAX } from '@/libs/better-auth/shared'

import { createVerificationDailyRateLimitStorage, resetVerificationRateLimitMemoryForTests } from './rate-limit-storage'

const SHORT_RULE = { max: 1, window: 60 }

describe('createVerificationDailyRateLimitStorage', () => {
  afterEach(() => {
    resetVerificationRateLimitMemoryForTests()
  })

  it('does not consume daily quota when short-window rejects', async () => {
    const storage = createVerificationDailyRateLimitStorage()
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
    const storage = createVerificationDailyRateLimitStorage()

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
    const storage = createVerificationDailyRateLimitStorage()
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
})
