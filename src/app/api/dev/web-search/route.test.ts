// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { searchService } from '@/server/search'

import { GET, POST } from './route'

vi.mock('@/server/search', () => ({
  searchService: {
    crawlPages: vi.fn(),
    query: vi.fn(),
    webSearch: vi.fn(),
  },
}))

const postJson = (body: unknown) => {
  return POST(
    new Request('http://localhost/api/dev/web-search', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  )
}

describe('/api/dev/web-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns available actions from GET', async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.actions).toEqual(['query', 'webSearch', 'crawlPages'])
  })

  it('dispatches query action to searchService.query', async () => {
    const result = {
      costTime: 12,
      query: 'nextjs',
      resultNumbers: 0,
      results: [],
    }
    vi.mocked(searchService.query).mockResolvedValue(result)

    const response = await postJson({
      action: 'query',
      params: {
        searchCategories: ['general'],
        searchEngines: ['google'],
        searchTimeRange: 'day',
      },
      query: ' nextjs ',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(searchService.query).toHaveBeenCalledWith('nextjs', {
      searchCategories: ['general'],
      searchEngines: ['google'],
      searchTimeRange: 'day',
    })
    expect(payload).toEqual({ action: 'query', result, success: true })
  })

  it('dispatches webSearch action to searchService.webSearch', async () => {
    const result = {
      costTime: 20,
      query: 'pure chat',
      resultNumbers: 1,
      results: [
        {
          content: 'A result',
          engines: ['searxng'],
          parsedUrl: 'purechat.dev',
          score: 1,
          title: 'PureChat',
          url: 'https://purechat.dev',
        },
      ],
    }
    vi.mocked(searchService.webSearch).mockResolvedValue(result)

    const response = await postJson({
      action: 'webSearch',
      query: 'pure chat',
      searchCategories: ['general'],
      searchEngines: ['searxng'],
      searchTimeRange: 'week',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(searchService.webSearch).toHaveBeenCalledWith({
      query: 'pure chat',
      searchCategories: ['general'],
      searchEngines: ['searxng'],
      searchTimeRange: 'week',
    })
    expect(payload).toEqual({ action: 'webSearch', result, success: true })
  })

  it('dispatches crawlPages action to searchService.crawlPages', async () => {
    const result = {
      results: [
        {
          crawler: 'naive',
          data: { content: 'ok', contentType: 'text', url: 'https://example.com' },
          originalUrl: 'https://example.com',
        },
      ],
    }
    vi.mocked(searchService.crawlPages).mockResolvedValue(result)

    const response = await postJson({
      action: 'crawlPages',
      impls: ['naive'],
      urls: ['https://example.com'],
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(searchService.crawlPages).toHaveBeenCalledWith({
      impls: ['naive'],
      urls: ['https://example.com'],
    })
    expect(payload).toEqual({ action: 'crawlPages', result, success: true })
  })

  it('returns 400 for invalid action', async () => {
    const response = await postJson({ action: 'missing' })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('Invalid action')
  })

  it('returns 400 for missing query', async () => {
    const response = await postJson({ action: 'webSearch', query: ' ' })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Missing or invalid "query" field', success: false })
  })

  it('returns 400 for empty urls', async () => {
    const response = await postJson({ action: 'crawlPages', urls: [] })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Missing or invalid "urls" field', success: false })
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/dev/web-search', {
        body: '{',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid JSON body', success: false })
  })

  it('returns 500 when service throws', async () => {
    vi.mocked(searchService.webSearch).mockRejectedValue(new Error('provider down'))

    const response = await postJson({ action: 'webSearch', query: 'test' })
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'provider down', success: false })
  })
})
