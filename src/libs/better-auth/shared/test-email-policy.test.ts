import { describe, expect, it } from 'vitest'

import { isObviousTestEmail } from './test-email-policy'

describe('isObviousTestEmail', () => {
  it('recognizes reserved test domains', () => {
    expect(isObviousTestEmail('test@example.com')).toBe(true)
    expect(isObviousTestEmail('ADMIN@sub.test')).toBe(true)
    expect(isObviousTestEmail('user@localhost')).toBe(true)
  })

  it('does not reject ordinary deliverable domains', () => {
    expect(isObviousTestEmail('test@gmail.com')).toBe(false)
    expect(isObviousTestEmail('user@purechat.example.cn')).toBe(false)
    expect(isObviousTestEmail('invalid-email')).toBe(false)
  })
})
