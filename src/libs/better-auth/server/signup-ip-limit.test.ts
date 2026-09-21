import { APIError } from 'better-auth/api'
import { afterEach, describe, expect, it } from 'vitest'

import { SIGNUP_DAILY_IP_MAX } from '@/libs/better-auth/shared'

import { createVerificationDailyRateLimitStorage, resetVerificationRateLimitMemoryForTests } from './rate-limit-storage'
import { assertSignupIpAllowed, resolveSignupIp, SIGNUP_TOO_MANY_MESSAGE } from './signup-ip-limit'

const headersFor = (ip: string) => new Headers({ 'cf-connecting-ip': ip })

describe('assertSignupIpAllowed', () => {
  afterEach(() => {
    resetVerificationRateLimitMemoryForTests()
  })

  it('allows SIGNUP_DAILY_IP_MAX accounts from one IP then rejects', async () => {
    const storage = createVerificationDailyRateLimitStorage({ redis: null })
    const context = { headers: headersFor('1.2.3.4') }

    for (let i = 0; i < SIGNUP_DAILY_IP_MAX; i++) {
      await expect(assertSignupIpAllowed(storage, context)).resolves.toBeUndefined()
    }

    await expect(assertSignupIpAllowed(storage, context)).rejects.toBeInstanceOf(APIError)
    await expect(assertSignupIpAllowed(storage, context)).rejects.toMatchObject({
      message: SIGNUP_TOO_MANY_MESSAGE,
    })
  })

  it('does not share quota across IPs', async () => {
    const storage = createVerificationDailyRateLimitStorage({ redis: null })
    const first = { headers: headersFor('1.2.3.4') }
    for (let i = 0; i < SIGNUP_DAILY_IP_MAX; i++) {
      await assertSignupIpAllowed(storage, first)
    }

    await expect(assertSignupIpAllowed(storage, { headers: headersFor('8.8.8.8') })).resolves.toBeUndefined()
  })

  it('treats missing IP as unknown', () => {
    expect(resolveSignupIp(null)).toBe('unknown')
    expect(resolveSignupIp(new Headers())).toBe('unknown')
  })
})
