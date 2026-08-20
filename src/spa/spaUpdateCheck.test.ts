import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SPA_UPDATE_DISMISS_KEY,
  checkForSpaUpdate,
  fetchRemoteSpaBuildTime,
  isSpaUpdatePreview,
  shouldNotifySpaUpdate,
} from './spaUpdateCheck'

describe('isSpaUpdatePreview', () => {
  it('is enabled by the query param', () => {
    expect(isSpaUpdatePreview('?spaUpdatePreview=1', undefined)).toBe(true)
  })

  it('is enabled by VITE_SPA_UPDATE_PREVIEW=1', () => {
    expect(isSpaUpdatePreview('', '1')).toBe(true)
  })

  it('is off by default', () => {
    expect(isSpaUpdatePreview('', '')).toBe(false)
    expect(isSpaUpdatePreview('?foo=1', '0')).toBe(false)
  })
})

describe('shouldNotifySpaUpdate', () => {
  it('returns false when fingerprints match', () => {
    expect(shouldNotifySpaUpdate('a', 'a', null)).toBe(false)
  })

  it('returns true when fingerprints differ', () => {
    expect(shouldNotifySpaUpdate('a', 'b', null)).toBe(true)
  })

  it('returns false when the remote fingerprint was dismissed', () => {
    expect(shouldNotifySpaUpdate('a', 'b', 'b')).toBe(false)
  })

  it('returns false when local or remote is missing', () => {
    expect(shouldNotifySpaUpdate(null, 'b', null)).toBe(false)
    expect(shouldNotifySpaUpdate('a', null, null)).toBe(false)
  })
})

describe('fetchRemoteSpaBuildTime', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns buildTime from a successful /api/version response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ buildTime: 'remote-time', version: '1.0.0' }),
        ok: true,
      })
    )

    await expect(fetchRemoteSpaBuildTime()).resolves.toBe('remote-time')
    expect(fetch).toHaveBeenCalledWith('/api/version', { cache: 'no-store' })
  })

  it('returns null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(fetchRemoteSpaBuildTime()).resolves.toBeNull()
  })
})

describe('checkForSpaUpdate', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.head.innerHTML = '<meta name="buildTime" content="local-time" />'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.head.innerHTML = ''
    sessionStorage.clear()
  })

  it('does not notify while a prompt is already showing', async () => {
    await expect(checkForSpaUpdate({ isShowing: true })).resolves.toEqual({ remote: null, show: false })
  })

  it('notifies when the remote fingerprint differs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ buildTime: 'remote-time' }),
        ok: true,
      })
    )

    await expect(checkForSpaUpdate({ isShowing: false })).resolves.toEqual({ remote: 'remote-time', show: true })
  })

  it('does not notify after the same remote fingerprint was dismissed', async () => {
    sessionStorage.setItem(SPA_UPDATE_DISMISS_KEY, 'remote-time')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ buildTime: 'remote-time' }),
        ok: true,
      })
    )

    await expect(checkForSpaUpdate({ isShowing: false })).resolves.toEqual({ remote: 'remote-time', show: false })
  })
})
