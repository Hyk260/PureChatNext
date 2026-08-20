import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('provider env key cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    window.__SERVER_CONFIG__ = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.__SERVER_CONFIG__ = undefined
  })

  async function loadModule() {
    const mod = await import('./envKeys')
    mod.resetProviderEnvKeyCacheForTests()
    return mod
  }

  it('uses injected server config without fetching', async () => {
    window.__SERVER_CONFIG__ = {
      renderedAt: '2026-01-01T00:00:00.000Z',
      providerEnvKeys: { deepseek: true, openai: false },
    }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { providerHasEnvApiKey } = await loadModule()

    await expect(providerHasEnvApiKey('deepseek')).resolves.toBe(true)
    await expect(providerHasEnvApiKey('openai')).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches and caches flags when the shell did not inject them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ envKeys: { deepseek: false, openai: true } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadProviderEnvKeyFlags, providerHasEnvApiKey } = await loadModule()

    await expect(loadProviderEnvKeyFlags()).resolves.toEqual({ deepseek: false, openai: true })
    await expect(providerHasEnvApiKey('openai')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/providers/config', {
      credentials: 'include',
    })
  })

  it('returns undefined when the config request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    )

    const { providerHasEnvApiKey } = await loadModule()
    await expect(providerHasEnvApiKey('openai')).resolves.toBeUndefined()
  })
})
