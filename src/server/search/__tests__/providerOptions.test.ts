// @vitest-environment node
import { SEARCH_PROVIDER_IDS } from '@pure/types'
import { describe, expect, it, vi } from 'vitest'

import { createSearchServiceImpl } from '../impls'
import type { SearchImplType } from '../impls'

describe('existing search provider request configuration', () => {
  it.each(SEARCH_PROVIDER_IDS)('%s uses request-scoped credentials, endpoint and transport', async (id) => {
    const fetch = vi.fn().mockRejectedValue(new Error('test transport stopped'))
    const impl = createSearchServiceImpl(id as SearchImplType, {
      apiKey: 'user-test-key',
      baseURL: 'https://user-endpoint.example/base',
      engineId: 'user-engine',
      basicAuthUsername: 'user',
      basicAuthPassword: 'password',
      fetch,
    })
    await impl.query('test').catch(() => {})
    expect(fetch).toHaveBeenCalled()
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toMatch(/^https:\/\/user-endpoint\.example\/base/)
    if (id === 'searxng') {
      expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('user:password').toString('base64')}`)
    } else if (id === 'google') {
      expect(new URL(url).searchParams.get('key')).toBe('user-test-key')
      expect(new URL(url).searchParams.get('cx')).toBe('user-engine')
    } else {
      expect(JSON.stringify(init.headers)).toContain('user-test-key')
    }
  })
})
