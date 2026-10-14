import { describe, expect, it } from 'vitest'

import { isUserCurrentlyBanned } from './user-status'

describe('isUserCurrentlyBanned', () => {
  it('allows active and expired accounts', () => {
    expect(isUserCurrentlyBanned({ banned: false })).toBe(false)
    expect(isUserCurrentlyBanned({ banned: true, banExpires: new Date(Date.now() - 1) })).toBe(false)
  })

  it('denies permanent, active, and malformed temporary bans', () => {
    expect(isUserCurrentlyBanned({ banned: true, banExpires: null })).toBe(true)
    expect(isUserCurrentlyBanned({ banned: true, banExpires: new Date(Date.now() + 60_000) })).toBe(true)
    expect(isUserCurrentlyBanned({ banned: true, banExpires: new Date(Number.NaN) })).toBe(true)
  })
})
