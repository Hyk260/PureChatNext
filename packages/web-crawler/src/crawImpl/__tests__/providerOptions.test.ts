import { describe, expect, it, vi } from 'vitest'

import { crawlImpls } from '../index'

const API_CRAWLERS = ['browserless', 'exa', 'firecrawl', 'jina', 'search1api', 'tavily'] as const

describe('crawler request configuration', () => {
  it.each(API_CRAWLERS)('%s uses injected credentials and endpoint without changing env', async (id) => {
    const fetch = vi.fn().mockRejectedValue(new Error('test transport stopped'))
    await crawlImpls[id]('https://public.example/page', {
      apiKey: 'owner-key',
      baseURL: 'https://owner-api.example/base',
      filterOptions: {},
      fetch,
    }).catch(() => {})
    expect(fetch).toHaveBeenCalled()
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toMatch(/^https:\/\/owner-api\.example\/base/)
    if (id === 'browserless') expect(new URL(url).searchParams.get('token')).toBe('owner-key')
    else expect(JSON.stringify(init.headers)).toContain('owner-key')
  })
})
