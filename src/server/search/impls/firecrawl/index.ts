import type { SearchParams, UniformSearchResponse, UniformSearchResult } from '@pure/types'
import debug from 'debug'
import urlJoin from 'url-join'

import type { SearchServiceImpl } from '../type'
import type { FirecrawlResponse, FirecrawlSearchParameters } from './type'

const log = debug('search:Firecrawl')

const TIME_RANGE_TO_TBS: Record<string, string> = {
  day: 'qdr:d',
  month: 'qdr:m',
  week: 'qdr:w',
  year: 'qdr:y',
}

const resolveTbs = (range: string | undefined): string | undefined =>
  range && range !== 'anytime' ? TIME_RANGE_TO_TBS[range] : undefined

const toSearchResult = (
  item: { title: string; url: string },
  category: string,
  content: string,
  url: string
): UniformSearchResult => ({
  category,
  content,
  engines: ['firecrawl'],
  parsedUrl: item.url ? new URL(item.url).hostname : '',
  score: 1,
  title: item.title || '',
  url,
})

/**
 * Firecrawl implementation of the search service
 * Primarily used for web crawling
 */
export class FirecrawlImpl implements SearchServiceImpl {
  private get apiKey(): string | undefined {
    return process.env.FIRECRAWL_API_KEY
  }

  private get baseUrl(): string {
    // Assuming the base URL is consistent with the crawl endpoint
    return process.env.FIRECRAWL_URL || 'https://api.firecrawl.dev/v2'
  }

  async query(query: string, params: SearchParams = {}): Promise<UniformSearchResponse> {
    log('Starting Firecrawl query with query: "%s", params: %o', query, params)
    const endpoint = urlJoin(this.baseUrl, '/search')

    const defaultQueryParams: FirecrawlSearchParameters = {
      limit: 20,
      query,
      /*
      scrapeOptions: {
        formats: ["markdown"]
      },
      */
      sources: [{ type: 'web' }, { type: 'news' }],
    }

    const body: FirecrawlSearchParameters = {
      ...defaultQueryParams,
      tbs: resolveTbs(params?.searchTimeRange),
    }

    log('Constructed request body: %o', body)

    let response: Response
    const startAt = Date.now()
    let costTime: number
    try {
      log('Sending request to endpoint: %s', endpoint)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`
      response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers,
        method: 'POST',
      })
      log('Received response with status: %d', response.status)
      costTime = Date.now() - startAt
    } catch (error) {
      log.extend('error')('Firecrawl fetch error: %o', error)
      throw new Error('Failed to connect to Firecrawl.', { cause: error })
    }

    if (!response.ok) {
      const errorBody = await response.text()
      log.extend('error')(
        `Firecrawl request failed with status ${response.status}: %s`,
        errorBody.length > 200 ? `${errorBody.slice(0, 200)}...` : errorBody
      )
      throw new Error(`Firecrawl request failed: ${response.statusText}`, { cause: errorBody })
    }

    try {
      const firecrawlResponse = (await response.json()) as FirecrawlResponse

      // V2 API returns data as object with web/images/news arrays
      const { web: webResults = [], images: imageResults = [], news: newsResults = [] } = firecrawlResponse.data
      log('Parsed Firecrawl response: web=%d news=%d images=%d', webResults.length, newsResults.length, imageResults.length)

      const mappedWebResults = webResults.map((result) =>
        toSearchResult(result, 'general', result.description || result.markdown || '', result.url)
      )

      const mappedNewsResults = newsResults.map((result) =>
        toSearchResult(result, 'news', result.snippet || result.markdown || '', result.url)
      )

      const mappedImageResults = imageResults.map((result) =>
        toSearchResult(result, 'images', result.title || '', result.imageUrl)
      )

      // Combine all results
      const allResults = [...mappedWebResults, ...mappedNewsResults, ...mappedImageResults]

      log('Mapped %d results to SearchResult format', allResults.length)

      if (firecrawlResponse.warning) {
        log.extend('warn')('Firecrawl warning: %s', firecrawlResponse.warning)
      }

      return {
        costTime,
        query,
        resultNumbers: allResults.length,
        results: allResults,
      }
    } catch (error) {
      log.extend('error')('Error parsing Firecrawl response: %o', error)
      throw new Error('Failed to parse Firecrawl response.', { cause: error })
    }
  }
}
