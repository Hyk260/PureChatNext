import { describe, expect, it } from 'vitest'

import { buildRequestBody, readCrawlItem, searchFallbackCopy } from './webSearchModel'
import type { WebSearchFormValues } from './webSearchModel'

const form = (patch: Partial<WebSearchFormValues> = {}): WebSearchFormValues => ({
  categories: 'general',
  engines: '',
  impls: '',
  provider: '',
  query: ' 今日新闻 ',
  timeRange: '',
  urls: '',
  ...patch,
})

describe('buildRequestBody', () => {
  it('puts query filters under params', () => {
    expect(buildRequestBody('query', form({ engines: 'bing', provider: 'tavily', timeRange: 'day' }))).toEqual({
      action: 'query',
      params: {
        searchCategories: ['general'],
        searchEngines: ['bing'],
        searchTimeRange: 'day',
      },
      provider: 'tavily',
      query: '今日新闻',
    })
  })

  it('flattens webSearch filters and omits empty ones', () => {
    expect(buildRequestBody('webSearch', form())).toEqual({
      action: 'webSearch',
      query: '今日新闻',
      searchCategories: ['general'],
    })
  })

  it('sends crawl urls and omits an empty impl list', () => {
    expect(
      buildRequestBody('crawlPages', form({ impls: 'jina, naive', urls: 'https://a.com\nhttps://b.com' })),
    ).toEqual({
      action: 'crawlPages',
      impls: ['jina', 'naive'],
      urls: ['https://a.com', 'https://b.com'],
    })

    expect(buildRequestBody('crawlPages', form({ urls: 'https://a.com' }))).toEqual({
      action: 'crawlPages',
      urls: ['https://a.com'],
    })
  })
})

describe('searchFallbackCopy', () => {
  it('maps fallback levels and hides none', () => {
    expect(searchFallbackCopy('none')).toBeNull()
    expect(searchFallbackCopy(undefined)).toBeNull()
    expect(searchFallbackCopy('engine-removed')).toBe('指定引擎无结果，已移除引擎限制。')
    expect(searchFallbackCopy('all-filters-removed')).toBe('仍无结果，已移除分类、引擎和时间范围限制。')
  })
})

describe('readCrawlItem', () => {
  it('reads an error payload', () => {
    expect(
      readCrawlItem({
        crawler: 'jina',
        data: { content: 'raw', errorMessage: 'timeout', errorType: 'Timeout' },
        originalUrl: 'https://a.com',
      }),
    ).toEqual({
      badge: 'Timeout',
      body: 'timeout',
      crawler: 'jina',
      isError: true,
      title: 'https://a.com',
      url: 'https://a.com',
    })
  })

  it('reads a success payload', () => {
    expect(
      readCrawlItem({
        crawler: 'naive',
        data: { content: 'hello', contentType: 'text', title: 'Hello', url: 'https://a.com' },
        originalUrl: 'https://a.com',
      }),
    ).toEqual({
      badge: 'text',
      body: 'hello',
      crawler: 'naive',
      isError: false,
      title: 'Hello',
      url: 'https://a.com',
    })
  })
})
