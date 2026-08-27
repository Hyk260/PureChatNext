import { describe, expect, it } from 'vitest'

import { isDangerousCommand, isToolApprovalRequired } from './permissionPolicy'

describe('permission policy', () => {
  it('approves safe reads in auto mode', () => {
    expect(
      isToolApprovalRequired({
        apiName: 'readFile',
        identifier: 'desktop-local-system',
        mode: 'auto',
      }).decision
    ).toBe('approved')
  })

  it('requires approval for writes in ask and auto modes', () => {
    for (const mode of ['ask', 'auto'] as const) {
      expect(isToolApprovalRequired({ apiName: 'writeFile', identifier: 'desktop-local-system', mode }).decision).toBe(
        'user-approval'
      )
    }
  })

  it('keeps full mode subject to dangerous command blacklist', () => {
    expect(isDangerousCommand('sudo rm -rf /')).toBe(true)
    expect(
      isToolApprovalRequired({
        apiName: 'runCommand',
        args: { command: 'sudo rm -rf /' },
        identifier: 'desktop-local-system',
        mode: 'full',
      }).decision
    ).toBe('denied')
  })
})
