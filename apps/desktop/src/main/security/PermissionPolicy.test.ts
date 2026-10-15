import { describe, expect, it } from 'vitest'

import { isRiskAllowed, requiresApproval } from './PermissionPolicy'

describe('desktop permission policy', () => {
  it('requires approval for writes and commands outside full mode', () => {
    expect(requiresApproval('ask', 'write')).toBe(true)
    expect(requiresApproval('auto', 'command')).toBe(true)
    expect(requiresApproval('full', 'write')).toBe(false)
  })

  it('keeps dangerous operations denied in every mode', () => {
    expect(isRiskAllowed('ask', 'dangerous')).toBe(false)
    expect(isRiskAllowed('full', 'dangerous')).toBe(false)
  })
})
