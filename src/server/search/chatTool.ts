import type { ChatWebSearchResultItem, ChatWebSearchToolResult } from '@pure/types'
import { tool } from 'ai'
import debug from 'debug'
import { z } from 'zod'

import { searchService } from '@/server/search'

const MAX_CONTENT_LENGTH = 600
const MAX_RESULT_COUNT = 5
const MAX_TITLE_LENGTH = 200
const SEARCH_UNAVAILABLE_MESSAGE = '联网搜索暂不可用，请检查搜索服务配置后重试。'
const log = debug('chat:web-search')

type WebSearchService = Pick<typeof searchService, 'webSearch'>

const normalizeHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const compactText = (value: string, maxLength: number) => value.replace(/\s+/g, ' ').trim().slice(0, maxLength)

const compactResults = (results: Awaited<ReturnType<WebSearchService['webSearch']>>['results']) => {
  const compacted: ChatWebSearchResultItem[] = []
  const seenUrls = new Set<string>()

  for (const result of results) {
    const url = normalizeHttpUrl(result.url)
    if (!url || seenUrls.has(url)) continue
    seenUrls.add(url)

    compacted.push({
      content: compactText(result.content, MAX_CONTENT_LENGTH),
      ...(result.publishedDate ? { publishedDate: result.publishedDate } : {}),
      title: compactText(result.title, MAX_TITLE_LENGTH) || url,
      url,
    })

    if (compacted.length === MAX_RESULT_COUNT) break
  }

  return compacted
}

export const createWebSearchTool = (service: WebSearchService = searchService) =>
  tool({
    description:
      'Search the public web when the question needs current or externally verifiable information. Base the answer on the returned sources and cite their URLs. Do not search when existing conversation knowledge is sufficient.',
    inputSchema: z.object({
      query: z.string().trim().min(1).max(300).describe('A concise web search query'),
    }),
    execute: async ({ query }): Promise<ChatWebSearchToolResult> => {
      const startedAt = Date.now()
      try {
        const response = await service.webSearch({ query }, { filterIrrelevant: true })
        const results = compactResults(response.results)

        log('completed q=%d results=%d durationMs=%d', query.length, results.length, Date.now() - startedAt)

        if (results.length === 0 && response.errorDetail) {
          log('provider failed q=%d: %s', query.length, response.errorDetail)
          return { error: SEARCH_UNAVAILABLE_MESSAGE, query, results: [], success: false }
        }

        return { query, results, success: true }
      } catch (error) {
        log('failed q=%d durationMs=%d: %O', query.length, Date.now() - startedAt, error)
        return { error: SEARCH_UNAVAILABLE_MESSAGE, query, results: [], success: false }
      }
    },
  })

export const webSearchTool = createWebSearchTool()
