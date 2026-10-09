// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createReferralContext, parseReferralContext } from './token'

const id = '2f1dff15-a679-4f4a-9b6b-6d8f7047474a'
const expiry = new Date('2026-10-16T00:00:00Z')

describe('signed referral contexts', () => {
  it('round trips without exposing a recipient', () => {
    const context = createReferralContext(id, expiry, 'secret')
    expect(parseReferralContext(context, 'secret')).toEqual({ id, exp: expiry.getTime() })
    expect(Buffer.from(context, 'base64url').toString()).not.toContain('@')
  })
  it('rejects signature tampering, key rotation and malformed data', () => {
    const context = createReferralContext(id, expiry, 'secret')
    expect(parseReferralContext(context, 'different')).toBeNull()
    const decoded = JSON.parse(Buffer.from(context, 'base64url').toString())
    decoded.token = decoded.token.slice(0, -1) + '!'
    expect(parseReferralContext(Buffer.from(JSON.stringify(decoded)).toString('base64url'), 'secret')).toBeNull()
    expect(parseReferralContext('invalid', 'secret')).toBeNull()
    expect(parseReferralContext('x'.repeat(3000), 'secret')).toBeNull()
    expect(
      parseReferralContext(Buffer.from(JSON.stringify({ v: 2, token: 'a.b' })).toString('base64url'), 'secret')
    ).toBeNull()
  })
})
