import { describe, expect, it } from 'vitest'

import { protocolLinksFromCommandLine, resolveProtocolLink } from './protocolLink'

describe('desktop protocol links', () => {
  it('keeps internal renderer links on the trusted origin', () => {
    expect(resolveProtocolLink('purechat://renderer/chat/123?from=email')).toBe(
      'purechat://renderer/chat/123?from=email'
    )
  })

  it('maps public deep links into the SPA path', () => {
    expect(resolveProtocolLink('purechat://chat/123')).toBe('purechat://renderer/chat/123')
  })

  it('ignores non-protocol and credential-bearing arguments', () => {
    expect(resolveProtocolLink('https://example.com')).toBeNull()
    expect(resolveProtocolLink('purechat://user:pass@chat/123')).toBeNull()
    expect(protocolLinksFromCommandLine(['--some-electron-flag', 'purechat://chat/123'])).toEqual([
      'purechat://chat/123',
    ])
  })
})
