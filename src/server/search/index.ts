import type { SearchParams, SearchQuery } from '@pure/types'
import type { Crawler, CrawlImplType, CrawlUniformResult } from '@pure/web-crawler'
import debug from 'debug'
import pMap from 'p-map'

import { toolsEnv } from '@/envs/tools'

import { createSearchServiceImpl, isSearchImplType, SearchImplType } from './impls'
import type { SearchServiceImpl } from './impls'
import { filterRelevantSearchResults } from './searchQuality'

const DEFAULT_CRAWL_CONCURRENCY = 3
const DEFAULT_CRAWLER_RETRY = 1
const log = debug('web-browsing:search-service')

type SearchProviderEntry = {
  impl: SearchServiceImpl
  type: SearchImplType
}

const parseImplEnv = (envString: string = '') => {
  const envValue = envString.replaceAll('，', ',').trim()
  return envValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const getMemorySnapshot = () => {
  if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') {
    return 'non-node'
  }

  const { heapUsed, rss } = process.memoryUsage()

  return `rss=${(rss / 1024 / 1024).toFixed(1)}MB heap=${(heapUsed / 1024 / 1024).toFixed(1)}MB`
}

export class SearchService {
  private searchImpList: SearchProviderEntry[]

  private get crawlerImpls() {
    return parseImplEnv(toolsEnv.CRAWLER_IMPLS)
  }

  private get crawlConcurrency() {
    return toolsEnv.CRAWL_CONCURRENCY ?? DEFAULT_CRAWL_CONCURRENCY
  }

  private get crawlerRetry() {
    return toolsEnv.CRAWLER_RETRY ?? DEFAULT_CRAWLER_RETRY
  }

  constructor() {
    const impls = this.searchImpls
    this.searchImpList =
      impls.length > 0
        ? impls.map((type) => ({ impl: createSearchServiceImpl(type), type }))
        : [{ impl: createSearchServiceImpl(), type: SearchImplType.SearXNG }]
  }

  async crawlPages(input: { impls?: CrawlImplType[]; urls: string[] }) {
    try {
      if (log.enabled) {
        log(
          'crawlPages:start urls=%d impls=%s mem=%s',
          input.urls.length,
          (input.impls || this.crawlerImpls).join(',') || '-',
          getMemorySnapshot()
        )
      }
    } catch {}

    const { Crawler } = await import('@pure/web-crawler')
    const crawler = new Crawler({ impls: this.crawlerImpls })

    const results = await pMap(
      input.urls,
      async (url) => {
        return await this.crawlWithRetry(crawler, url, input.impls)
      },
      { concurrency: this.crawlConcurrency }
    )

    return { results }
  }

  private async crawlWithRetry(crawler: Crawler, url: string, impls?: CrawlImplType[]): Promise<CrawlUniformResult> {
    const maxAttempts = this.crawlerRetry + 1
    let lastResult: CrawlUniformResult | undefined
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await crawler.crawl({ impls, url })
        try {
          if (log.enabled) {
            log('crawlWithRetry:result crawler=%s mem=%s', result.crawler, getMemorySnapshot())
          }
        } catch {}
        lastResult = result

        if (!this.isFailedCrawlResult(result)) {
          return result
        }
      } catch (error) {
        lastError = error as Error
      }
    }

    if (lastResult) {
      return lastResult
    }

    return {
      crawler: 'unknown',
      data: {
        content: `Fail to crawl the page. Error type: ${lastError?.name || 'UnknownError'}, error message: ${lastError?.message}`,
        errorMessage: lastError?.message,
        errorType: lastError?.name || 'UnknownError',
      },
      originalUrl: url,
    }
  }

  /**
   * 成功的抓取结果在 `result.data` 中始终包含 `contentType`（例如 'text'、'json'），
   * 而失败的结果则包含 `errorType`/`errorMessage`。
   */
  private isFailedCrawlResult(result: CrawlUniformResult): boolean {
    return !('contentType' in result.data)
  }

  private get searchImpls() {
    return parseImplEnv(toolsEnv.SEARCH_PROVIDERS).filter(isSearchImplType)
  }

  private resolveProviders(provider?: SearchImplType): SearchProviderEntry[] {
    if (!provider) {
      return this.searchImpList
    }

    const existing = this.searchImpList.find((entry) => entry.type === provider)
    if (existing) {
      return [existing]
    }

    return [{ impl: createSearchServiceImpl(provider), type: provider }]
  }

  /**
   * 使用指定实现查询搜索结果
   */
  private async queryWithImpl(
    impl: SearchServiceImpl,
    query: string,
    params: SearchParams | undefined,
    provider: SearchImplType
  ) {
    try {
      const data = await impl.query(query, params)
      return {
        ...data,
        provider,
        resultNumbers: data.resultNumbers ?? data.results?.length ?? 0,
        results: data.results ?? [],
      }
    } catch (e) {
      console.error('[SearchService] query failed:', (e as Error).message)
      return {
        costTime: 0,
        errorDetail: (e as Error).message,
        provider,
        query,
        resultNumbers: 0,
        results: [],
      }
    }
  }

  /**
   * 查询搜索结果（默认使用第一个提供者；可通过 provider 指定）
   */
  async query(query: string, params?: SearchParams, options?: { provider?: SearchImplType }) {
    const [entry] = this.resolveProviders(options?.provider)
    return this.queryWithImpl(entry.impl, query, params, entry.type)
  }

  async webSearch(
    { query, searchCategories, searchEngines, searchTimeRange }: SearchQuery,
    options?: { filterIrrelevant?: boolean; provider?: SearchImplType }
  ) {
    const providers = this.resolveProviders(options?.provider)

    try {
      if (log.enabled) {
        log(
          'webSearch:start providers=%d q=%d c=%d e=%d mem=%s',
          providers.length,
          query.length,
          searchCategories?.length || 0,
          searchEngines?.length || 0,
          getMemorySnapshot()
        )
      }
    } catch {}

    let lastErrorDetail: string | undefined
    let lastProvider: SearchImplType | undefined

    for (const { impl, type } of providers) {
      lastProvider = type

      try {
        if (log.enabled) {
          log('webSearch:impl impl=%s mem=%s', type, getMemorySnapshot())
        }
      } catch {}

      let data = await this.queryWithImpl(impl, query, {
        searchCategories,
        searchEngines,
        searchTimeRange,
      }, type)
      if (data.errorDetail) lastErrorDetail = data.errorDetail

      if (options?.filterIrrelevant) {
        const results = filterRelevantSearchResults(query, data.results)
        data = { ...data, resultNumbers: results.length, results }
      }

      // 第一次重试：如果没有结果，移除搜索引擎限制
      if (data.results.length === 0 && searchEngines && searchEngines?.length > 0) {
        data = await this.queryWithImpl(impl, query, {
          searchCategories,
          searchEngines: undefined,
          searchTimeRange,
        }, type)
        if (data.errorDetail) lastErrorDetail = data.errorDetail
        if (options?.filterIrrelevant) {
          const results = filterRelevantSearchResults(query, data.results)
          data = { ...data, resultNumbers: results.length, results }
        }
      }

      // 第二次重试：如果仍然没有结果，移除所有限制
      if (data.results.length === 0) {
        data = await this.queryWithImpl(impl, query, undefined, type)
        if (data.errorDetail) lastErrorDetail = data.errorDetail
        if (options?.filterIrrelevant) {
          const results = filterRelevantSearchResults(query, data.results)
          data = { ...data, resultNumbers: results.length, results }
        }
      }

      // 如果此提供者返回了结果，直接使用
      if (data.results.length > 0) {
        return data
      }
    }

    // 所有提供者均已尝试完毕，返回空结果
    return {
      costTime: 0,
      ...(lastErrorDetail ? { errorDetail: lastErrorDetail } : {}),
      ...(lastProvider ? { provider: lastProvider } : {}),
      query,
      resultNumbers: 0,
      results: [],
    }
  }
}

export const searchService = new SearchService()
