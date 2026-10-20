import { describe, expect, it } from 'vitest'

import { isDangerousCommand, isToolApprovalRequired } from '../permissionPolicy'

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

  it('keeps user choice in ask mode and handles known tools automatically in auto mode', () => {
    expect(isToolApprovalRequired({ apiName: 'writeFile', identifier: 'desktop-local-system', mode: 'ask' }).decision)
      .toBe('user-approval')
    expect(isToolApprovalRequired({ apiName: 'writeFile', identifier: 'desktop-local-system', mode: 'auto' }).decision)
      .toBe('approved')
  })

  it('denies unknown tools in auto mode instead of creating a manual approval request', () => {
    expect(isToolApprovalRequired({ apiName: 'unknownTool', identifier: 'unknown', mode: 'auto' })).toMatchObject({
      decision: 'denied',
    })
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
