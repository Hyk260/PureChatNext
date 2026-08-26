import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getProviderEnvKeyFlags', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('reports presence without exposing the key', async () => {
    vi.stubEnv('OPENAI_API_KEY', ' sk-openai ')
    vi.stubEnv('DEEPSEEK_API_KEY', '   ')

    const { getProviderEnvKeyFlags } = await import('./envKeys')
    expect(getProviderEnvKeyFlags()).toEqual({ deepseek: false, openai: true })
  })
})
