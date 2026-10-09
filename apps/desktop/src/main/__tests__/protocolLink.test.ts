import { describe, expect, it } from 'vitest'

import {
  isRecognizedProtocolLink,
  parseDesktopAuthCallback,
  protocolLinksFromCommandLine,
  resolveProtocolLink,
} from '../protocolLink'

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

  it('keeps desktop auth callbacks out of the renderer origin', () => {
    const link = 'purechat://auth/callback?code=one-time-code&state=state-123'
    expect(isRecognizedProtocolLink(link)).toBe(true)
    expect(resolveProtocolLink(link)).toBeNull()
    expect(parseDesktopAuthCallback(link)).toEqual({
      code: 'one-time-code',
      error: null,
      errorDescription: null,
      state: 'state-123',
    })
  })

  it('rejects auth callbacks with credentials or ports', () => {
    expect(parseDesktopAuthCallback('purechat://user:pass@auth/callback?code=x&state=y')).toBeNull()
    expect(parseDesktopAuthCallback('purechat://auth:123/callback?code=x&state=y')).toBeNull()
  })
})
