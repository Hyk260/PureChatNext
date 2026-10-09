import { describe, expect, it } from 'vitest'

import { resolveDesktopApiUrl } from '../desktopFetch'

describe('resolveDesktopApiUrl', () => {
  const rendererOrigin = 'http://127.0.0.1:5176'

  it('builds a custom-protocol URL without falling back to HTTP', () => {
    const result = resolveDesktopApiUrl(
      new URL('http://127.0.0.1:5176/api/auth/me?source=desktop'),
      rendererOrigin
    )

    expect(result?.toString()).toBe('purechat://renderer/api/auth/me?source=desktop')
    expect(result?.protocol).toBe('purechat:')
  })

  it('leaves non-API and cross-origin requests untouched', () => {
    expect(resolveDesktopApiUrl(new URL('http://127.0.0.1:5176/chat'), rendererOrigin)).toBeNull()
    expect(resolveDesktopApiUrl(new URL('https://example.com/api/auth/me'), rendererOrigin)).toBeNull()
  })
})
