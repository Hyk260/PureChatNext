// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/envs/tools', () => ({
  toolsEnv: {
    EXA_API_KEY: 'server-secret',
    SEARCH_PROVIDERS: 'exa,brave',
    CRAWLER_IMPLS: 'naive',
    SEARXNG_URL: 'http://localhost:8180',
    BROWSERLESS_URL: 'https://browser.example?token=private',
  },
}))

import * as implementations from '../impls'
import {
  createUserSearchService,
  resolveWebProviderOptions,
  rotateWebKey,
  serverWebSearchConfig,
} from '../userSettings'

afterEach(() => vi.restoreAllMocks())

describe('account web search configuration', () => {
  it('inherits env per field and refuses forwarding env keys to custom endpoints', () => {
    expect(resolveWebProviderOptions({}, 'exa', 'search')).toMatchObject({
      apiKey: 'server-secret',
      baseURL: 'https://api.exa.ai',
    })
    const settings = { providers: { exa: { searchBaseURL: 'https://proxy.example/v2' } } }
    expect(() => resolveWebProviderOptions(settings, 'exa', 'search')).toThrow('自己的 API 密钥')
    expect(resolveWebProviderOptions(settings, 'exa', 'search', 'user-secret')).toMatchObject({
      apiKey: 'user-secret',
      baseURL: 'https://proxy.example/v2',
    })
    const publicConfig = JSON.stringify(serverWebSearchConfig())
    expect(publicConfig).not.toContain('server-secret')
    expect(publicConfig).not.toContain('private')
    expect(serverWebSearchConfig().providers.exa?.hasApiKey).toBe(true)
  })

  it('isolates key rotation by owner and provider', () => {
    expect(rotateWebKey('owner-a', 'exa', ['a1', 'a2'])).toBe('a1')
    expect(rotateWebKey('owner-b', 'exa', ['b1', 'b2'])).toBe('b1')
    expect(rotateWebKey('owner-a', 'exa', ['a1', 'a2'])).toBe('a2')
    expect(rotateWebKey('owner-a', 'tavily', ['t1', 't2'])).toBe('t1')
  })

  it('uses only the selected provider, retaining the env chain when no selection exists', async () => {
    const query = vi.fn().mockResolvedValue({ query: 'test', costTime: 0, results: [], resultNumbers: 0 })
    const factory = vi.spyOn(implementations, 'createSearchServiceImpl').mockReturnValue({ query })
    await createUserSearchService(
      { searchProvider: 'exa', providers: { exa: { apiKeys: ['user-key'] } } },
      'owner',
      'search'
    ).webSearch({ query: 'test' })
    expect(factory.mock.calls.map(([id]) => id)).toEqual(['exa'])
    expect(factory.mock.calls[0][1]?.apiKey).toBe('user-key')
    factory.mockClear()
    createUserSearchService({}, 'owner', 'search')
    expect(factory.mock.calls.map(([id]) => id)).toEqual(['exa', 'brave'])
  })
})
