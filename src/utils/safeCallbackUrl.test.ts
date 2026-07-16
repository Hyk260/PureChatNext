import { describe, expect, it } from 'vitest'

import { resolveCallbackUrl } from './safeCallbackUrl'

describe('resolveCallbackUrl', () => {
  it('keeps relative app paths', () => {
    expect(resolveCallbackUrl('/chat')).toBe('/chat')
    expect(resolveCallbackUrl('/chat?agent=1')).toBe('/chat?agent=1')
    expect(resolveCallbackUrl('/settings/profile')).toBe('/settings/profile')
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(resolveCallbackUrl('https://evil.com')).toBe('/')
    expect(resolveCallbackUrl('//evil.com')).toBe('/')
    expect(resolveCallbackUrl('http://localhost:5174/chat')).toBe('/')
  })

  it('uses fallback when empty', () => {
    expect(resolveCallbackUrl(null, '/home')).toBe('/home')
    expect(resolveCallbackUrl('  ', '/home')).toBe('/home')
  })
})
