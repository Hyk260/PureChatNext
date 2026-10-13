import { describe, expect, it } from 'vitest'

import { shouldEnforceSingleInstanceLock } from './instancePolicy'

describe('desktop instance policy', () => {
  it('keeps Windows single-instance so protocol callbacks return to the existing window', () => {
    expect(shouldEnforceSingleInstanceLock('win32', true)).toBe(true)
    expect(shouldEnforceSingleInstanceLock('win32', false)).toBe(true)
  })

  it('honors the multi-instance setting on other platforms', () => {
    expect(shouldEnforceSingleInstanceLock('darwin', true)).toBe(false)
    expect(shouldEnforceSingleInstanceLock('linux', true)).toBe(false)
    expect(shouldEnforceSingleInstanceLock('darwin', false)).toBe(true)
    expect(shouldEnforceSingleInstanceLock('linux', false)).toBe(true)
  })
})
