import { describe, expect, it, vi } from 'vitest'

import { parseAccessTokenExpiry } from '../accessTokenExpiry'

vi.mock('@/envs/auth', () => ({ authEnv: { JWT_ACCESS_EXPIRATION: '15m' } }))

describe('parseAccessTokenExpiry', () => {
  it.each([
    ['15m', 900], ['2h', 7200], ['1D', 86400], ['30s', 30], ['0m', 0],
    ['', 900], ['invalid', 900], ['1w', 900], [' 15m ', 900],
  ])('preserves expiry parsing for %j', (value, expected) => {
    expect(parseAccessTokenExpiry(value)).toBe(expected)
  })
})
