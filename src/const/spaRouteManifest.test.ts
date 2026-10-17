import { describe, expect, it } from 'vitest'

import { isKnownSpaRoute } from './spaRouteManifest'

describe('isKnownSpaRoute', () => {
  it('matches static and supported dynamic routes', () => {
    expect(isKnownSpaRoute('/community/provider')).toBe(true)
    expect(isKnownSpaRoute('/resources/library/guide/example', false)).toBe(true)
    expect(isKnownSpaRoute('/share/t/abc123', false)).toBe(true)
    expect(isKnownSpaRoute('/settings/messenger/wechat', false)).toBe(true)
  })

  it('excludes the router fallback and production development routes', () => {
    expect(isKnownSpaRoute('/missing-page', false)).toBe(false)
    expect(isKnownSpaRoute('/dev/context-window', false)).toBe(false)
    expect(isKnownSpaRoute('/dev/context-window', true)).toBe(true)
  })
})
