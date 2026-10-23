import { describe, expect, it } from 'vitest'

import {
  getReferralContext,
  isReferralCallback,
  maskReferralEmail,
  parseReferralEmails,
  referralCallback,
  sanitizeReferralTelemetryUrl,
} from './helpers'

describe('referral input', () => {
  it.each([
    ['331234@qq.com', '33***4@qq.com'],
    ['alice@qq.com', 'a***e@qq.com'],
    ['abcd@qq.com', 'a***d@qq.com'],
    ['abc@qq.com', 'a***@qq.com'],
    ['ab@qq.com', '***@qq.com'],
    ['a@qq.com', '***@qq.com'],
  ])('masks %s without revealing short mailbox names', (email, masked) => {
    expect(maskReferralEmail(email)).toBe(masked)
  })
  it('keeps signed email context through nested authentication callbacks', () => {
    expect(getReferralContext(new URLSearchParams({ callbackUrl: referralCallback('signed') }))).toBe('signed')
    expect(
      getReferralContext(new URLSearchParams({ referral_context: 'direct', callbackUrl: referralCallback('nested') }))
    ).toBe('direct')
    expect(getReferralContext(new URLSearchParams({ callbackUrl: '/chat?referral_context=untrusted' }))).toBe('')
  })
  it('normalizes mixed separators and deduplicates case-insensitively', () => {
    expect(parseReferralEmails(' A@qq.com，b@qq.com;A@QQ.COM\nc@qq.com ')).toEqual({
      emails: ['a@qq.com', 'b@qq.com', 'c@qq.com'],
      error: null,
    })
  })
  it('reports invalid and empty input, and limits unique recipients', () => {
    expect(parseReferralEmails('').error).toBeTruthy()
    expect(parseReferralEmails('invalid;ok@qq.com').error).toContain('invalid')
    expect(parseReferralEmails(Array.from({ length: 4 }, (_, index) => `u${index}@qq.com`).join(',')).error).toContain(
      '3'
    )
    expect(parseReferralEmails(Array(4).fill('one@qq.com').join(',')).error).toBeNull()
    expect(parseReferralEmails('a@qq.com,b@qq.com,c@qq.com').error).toBeNull()
  })
  it('recognizes only the referral landing callback', () => {
    expect(isReferralCallback(referralCallback('test'))).toBe(true)
    expect(isReferralCallback('/signup?referral_context=test')).toBe(false)
    expect(isReferralCallback('/accept-referral')).toBe(false)
  })
  it('removes tokens from landing, nested signup and verification telemetry', () => {
    expect(sanitizeReferralTelemetryUrl('/accept-referral?referral_context=secret')).toBe('/accept-referral')
    const callbackUrl = referralCallback('secret')
    expect(
      sanitizeReferralTelemetryUrl(`/signup?${new URLSearchParams({ callbackUrl, email: 'friend@qq.com' })}`)
    ).toBe('/signup')
    expect(
      sanitizeReferralTelemetryUrl(
        `https://purechat.cn/verify-email?${new URLSearchParams({ callbackURL: callbackUrl })}`
      )
    ).toBe('https://purechat.cn/verify-email')
    expect(sanitizeReferralTelemetryUrl('/chat?topic=normal')).toBe('/chat?topic=normal')
  })
})
