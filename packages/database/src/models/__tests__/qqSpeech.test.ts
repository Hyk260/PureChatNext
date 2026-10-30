import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { qqSpeechAdmission } from '../qqSpeech'
import type { QQSpeechAttempt } from '../qqSpeech'

describe('QQ shared admission policy', () => {
  const now = new Date('2026-10-30T10:00:00Z')
  const attempt = (senderId: string, state: QQSpeechAttempt['state'] = 'fallback', age = 10_000): QQSpeechAttempt => ({
    senderId,
    state,
    requestedAt: new Date(now.getTime() - age).toISOString(),
  })

  it('counts failed attempts per sender and binding, with independent sender identities', () => {
    expect(qqSpeechAdmission([attempt('a'), attempt('a'), attempt('a')], 'a', now)).toBe('SENDER_RATE_LIMIT')
    expect(qqSpeechAdmission([attempt('a'), attempt('a'), attempt('a')], 'b', now)).toBeUndefined()
    expect(
      qqSpeechAdmission(
        Array.from({ length: 20 }, (_, index) => attempt(String(index))),
        'new',
        now
      )
    ).toBe('BINDING_RATE_LIMIT')
  })

  it('expires crashed reservations after the voice deadline and resets the rolling minute', () => {
    expect(qqSpeechAdmission([attempt('a', 'pending'), attempt('b', 'pending')], 'c', now)).toBe('CONCURRENCY_LIMIT')
    expect(
      qqSpeechAdmission([attempt('a', 'pending', 30_001), attempt('b', 'pending', 30_001)], 'c', now)
    ).toBeUndefined()
    expect(
      qqSpeechAdmission(
        Array.from({ length: 20 }, () => attempt('a', 'failed', 60_000)),
        'a',
        now
      )
    ).toBeUndefined()
  })
})
