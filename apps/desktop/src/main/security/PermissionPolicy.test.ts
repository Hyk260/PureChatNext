import { describe, expect, it } from 'vitest'

import { isRiskAllowed, requiresNativeApproval } from './PermissionPolicy'

describe('desktop permission policy', () => {
  it('requires native approval for writes and commands outside full mode', () => {
    expect(requiresNativeApproval('ask', 'write')).toBe(true)
    expect(requiresNativeApproval('auto', 'command')).toBe(true)
    expect(requiresNativeApproval('full', 'write')).toBe(false)
  })

  it('keeps dangerous operations denied in every mode', () => {
    expect(isRiskAllowed('ask', 'dangerous')).toBe(false)
    expect(isRiskAllowed('full', 'dangerous')).toBe(false)
  })
})
