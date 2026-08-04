import { SEARCH_SEARXNG_NOT_CONFIG } from '@pure/types'
import type { UniformSearchResponse } from '@pure/types'

import { toolsEnv } from '@/envs/tools'
import { SearXNGClient } from './client'

import type { SearchServiceImpl } from '../type'

/**
 * SearXNG implementation of the search service
 */
export class SearXNGImpl implements SearchServiceImpl {
  async query(
    query: string,
    params?: {
      searchCategories?: string[]
      searchEngines?: string[]
      searchTimeRange?: string
    }
  ): Promise<UniformSearchResponse> {
    if (!toolsEnv.SEARXNG_URL) {
      throw new Error(SEARCH_SEARXNG_NOT_CONFIG)
    }

    const client = new SearXNGClient(toolsEnv.SEARXNG_URL)

    try {
      let costTime = 0
      const startAt = Date.now()
      const data = await client.search(query, {
        categories: params?.searchCategories,
        engines: params?.searchEngines,
        time_range: params?.searchTimeRange,
      })
      costTime = Date.now() - startAt

      // SearXNG 常省略 number_of_results；undefined 经 JSON 序列化会被丢弃，
      // 导致前端用 resultNumbers 做类型判断时识别失败。
      const resultNumbers =
        typeof data.number_of_results === 'number' ? data.number_of_results : data.results.length

      return {
        costTime,
        query,
        resultNumbers,
        results: data.results.map((item) => ({
          category: item.category,
          content: item.content ?? '',
          engines: item.engines,
          parsedUrl: item.url ? new URL(item.url).hostname : '',
          publishedDate: item.publishedDate || undefined,
          score: item.score,
          thumbnail: item.thumbnail || undefined,
          title: item.title,
          url: item.url,
        })),
      }
    } catch (e) {
      console.error(e)

      throw new Error((e as Error).message)
    }
  }
}
