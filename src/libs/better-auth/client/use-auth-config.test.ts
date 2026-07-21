import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type AuthServerConfig } from '@/libs/better-auth/shared'

const mockConfig: AuthServerConfig = {
  emailVerificationMode: 'link',
  enableEmailVerification: true,
  enableMagicLink: true,
  oAuthSSOProviders: ['github'],
}

const defaultConfig: AuthServerConfig = {
  emailVerificationMode: 'otp',
  enableEmailVerification: false,
  enableMagicLink: false,
  oAuthSSOProviders: [],
}

describe('auth config cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadModule() {
    const mod = await import('./use-auth-config')
    mod.resetAuthConfigCacheForTests()
    return mod
  }

  it('fetches once and caches the successful config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => mockConfig,
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadAuthServerConfig, getCachedAuthConfig } = await loadModule()

    await expect(loadAuthServerConfig()).resolves.toEqual(mockConfig)
    expect(getCachedAuthConfig()).toEqual(mockConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/config', {
      credentials: 'include',
    })

    await expect(loadAuthServerConfig()).resolves.toEqual(mockConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares a single inflight request for concurrent callers', async () => {
    let resolveJson: (value: AuthServerConfig) => void = () => {}
    const jsonPromise = new Promise<AuthServerConfig>((resolve) => {
      resolveJson = resolve
    })

    const fetchMock = vi.fn().mockResolvedValue({
      json: () => jsonPromise,
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadAuthServerConfig } = await loadModule()

    const p1 = loadAuthServerConfig()
    const p2 = loadAuthServerConfig()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveJson(mockConfig)
    await expect(Promise.all([p1, p2])).resolves.toEqual([mockConfig, mockConfig])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches defaultConfig when fetch fails and does not refetch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', fetchMock)

    const { loadAuthServerConfig, getCachedAuthConfig } = await loadModule()

    await expect(loadAuthServerConfig()).resolves.toEqual(defaultConfig)
    expect(getCachedAuthConfig()).toEqual(defaultConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(loadAuthServerConfig()).resolves.toEqual(defaultConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
