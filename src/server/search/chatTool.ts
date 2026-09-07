import type { ChatWebSearchResultItem, ChatWebSearchToolResult, SearchQuery } from '@pure/types'
import { tool } from 'ai'
import debug from 'debug'
import { z } from 'zod'

import { searchService } from '@/server/search'

const MAX_CONTENT_LENGTH = 600
const MAX_RESULT_COUNT = 5
const MAX_TITLE_LENGTH = 200
const SEARCH_UNAVAILABLE_MESSAGE = '联网搜索暂不可用，请检查搜索服务配置后重试。'
const log = debug('chat:web-search')

const SEARCH_CATEGORIES = ['general', 'news', 'images', 'videos', 'it', 'science', 'social media'] as const
const SEARCH_TIME_RANGES = ['day', 'week', 'month', 'year'] as const

const CALENDAR_DATE_PATTERN = /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/gu

type WebSearchService = Pick<typeof searchService, 'webSearch'>
type SearchCategory = (typeof SEARCH_CATEGORIES)[number]
type SearchTimeRange = (typeof SEARCH_TIME_RANGES)[number]

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

/** Models often copy the runtime clock into keywords, which turns news search into year/calendar pages. */
export const sanitizeWebSearchQuery = (query: string) => {
  const stripped = query.replace(CALENDAR_DATE_PATTERN, ' ').replace(/\s+/g, ' ').trim()
  return stripped || query.replace(/\s+/g, ' ').trim()
}

export const resolveWebSearchQuery = (input: {
  query: string
  searchCategories?: SearchCategory[]
  searchTimeRange?: SearchTimeRange
}): SearchQuery => {
  const query = sanitizeWebSearchQuery(input.query)
  return {
    query,
    ...(input.searchCategories?.length ? { searchCategories: [...input.searchCategories] } : {}),
    ...(input.searchTimeRange ? { searchTimeRange: input.searchTimeRange } : {}),
  }
}

export const createWebSearchTool = (service: WebSearchService = searchService) =>
  tool({
    description:
      'Search the public web when the question needs current or externally verifiable information. Use topic keywords only; never put calendar dates such as 2026-09-07 or 2026年9月7日 in the query. For news, search with queries like "中国 今日新闻 要闻". If results are encyclopedias, calendars, homepages, or otherwise unusable, search once more with a different query, then answer. After two search rounds, write the user-facing answer from the sources you have; never emit XML, DSML, or tool-call markup. When the user asks to continue, summarize, or narrow the topic after a previous search, search again instead of asking them to choose a format. Base the answer on returned sources and cite URLs.',
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .describe('Topic keywords only. Do not include calendar dates; today is already known.'),
      searchCategories: z
        .array(z.enum(SEARCH_CATEGORIES))
        .max(3)
        .optional()
        .describe('Optional categories. Use ["news"] for current headlines.'),
      searchTimeRange: z
        .enum(SEARCH_TIME_RANGES)
        .optional()
        .describe('Optional recency filter. Prefer week; day is often empty.'),
    }),
    execute: async ({ query, searchCategories, searchTimeRange }): Promise<ChatWebSearchToolResult> => {
      const startedAt = Date.now()
      const request = resolveWebSearchQuery({ query, searchCategories, searchTimeRange })
      try {
        const response = await service.webSearch(request, { filterIrrelevant: true })
        const results = compactResults(response.results)

        log(
          'completed q=%d sanitized=%d results=%d durationMs=%d',
          query.length,
          request.query.length,
          results.length,
          Date.now() - startedAt
        )

        if (results.length === 0 && response.errorDetail) {
          log('provider failed q=%d: %s', request.query.length, response.errorDetail)
          return { error: SEARCH_UNAVAILABLE_MESSAGE, query: request.query, results: [], success: false }
        }

        return { query: request.query, results, success: true }
      } catch (error) {
        log('failed q=%d durationMs=%d: %O', request.query.length, Date.now() - startedAt, error)
        return { error: SEARCH_UNAVAILABLE_MESSAGE, query: request.query, results: [], success: false }
      }
    },
  })

export const webSearchTool = createWebSearchTool()
