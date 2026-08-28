import type { CrawlImplType } from '@pure/web-crawler'
import type { SearchImplType } from '@/server/search/impls'

import { NextResponse } from 'next/server'

import { isRecord, toTrimmedString } from '@pure/utils/object'
import { searchService } from '@/server/search'
import { SEARCH_IMPL_TYPES, isSearchImplType } from '@/server/search/impls'
import { toolsEnv } from '@/envs/tools'
import { devActionSuccess, devError } from '../_utils'

type WebSearchAction = 'query' | 'webSearch' | 'crawlPages'

const availableActions: WebSearchAction[] = ['query', 'webSearch', 'crawlPages']

const stringArrayOrUndefined = (value: unknown) => {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

const parseProvider = (value: unknown): SearchImplType | undefined | 'invalid' => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    return 'invalid'
  }

  const provider = value.trim()
  if (!provider) {
    return undefined
  }

  return isSearchImplType(provider) ? provider : 'invalid'
}

/**
 * 联网搜索测试 API（仅开发环境）
 * POST /api/dev/web-search
 */
export const POST = async (req: Request) => {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return devError('Invalid JSON body')
  }

  if (!isRecord(body)) {
    return devError('Request body must be an object')
  }

  const rawAction = body.action

  if (typeof rawAction !== 'string' || !availableActions.includes(rawAction as WebSearchAction)) {
    return devError(`Invalid action. Available actions: ${availableActions.join(', ')}`)
  }

  const action = rawAction as WebSearchAction
  const provider = parseProvider(body.provider)

  if (provider === 'invalid') {
    return devError(`Invalid provider. Available providers: ${SEARCH_IMPL_TYPES.join(', ')}`)
  }

  try {
    if (action === 'query') {
      const query = toTrimmedString(body.query)

      if (!query) {
        return devError('Missing or invalid "query" field')
      }

      const rawParams = isRecord(body.params) ? body.params : {}
      const result = await searchService.query(
        query,
        {
          searchCategories: stringArrayOrUndefined(rawParams.searchCategories),
          searchEngines: stringArrayOrUndefined(rawParams.searchEngines),
          searchTimeRange: toTrimmedString(rawParams.searchTimeRange),
        },
        { provider }
      )

      return devActionSuccess(action, result)
    }

    if (action === 'webSearch') {
      const query = toTrimmedString(body.query)

      if (!query) {
        return devError('Missing or invalid "query" field')
      }

      const result = await searchService.webSearch(
        {
          query,
          searchCategories: stringArrayOrUndefined(body.searchCategories),
          searchEngines: stringArrayOrUndefined(body.searchEngines),
          searchTimeRange: toTrimmedString(body.searchTimeRange),
        },
        { provider }
      )

      return devActionSuccess(action, result)
    }

    const urls = stringArrayOrUndefined(body.urls) ?? []

    if (urls.length === 0) {
      return devError('Missing or invalid "urls" field')
    }

    const result = await searchService.crawlPages({
      impls: stringArrayOrUndefined(body.impls) as CrawlImplType[] | undefined,
      urls,
    })

    return devActionSuccess(action, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'

    return devError(message, 500)
  }
}

/**
 * 联网搜索测试 API（仅开发环境）
 * GET /api/dev/web-search
 */
export const GET = async () => {
  let searxng: { engines: Array<{ categories: string[]; enabled: boolean; name: string; timeRangeSupport: boolean }> } | null = null

  if (toolsEnv.SEARXNG_URL) {
    try {
      const response = await fetch(new URL('/config', toolsEnv.SEARXNG_URL), {
        signal: AbortSignal.timeout(2500),
      })
      if (response.ok) {
        const config = (await response.json()) as { engines?: Array<{ categories?: string[]; enabled?: boolean; name?: string; time_range_support?: boolean }> }
        searxng = {
          engines: (config.engines ?? [])
            .filter((engine) => typeof engine.name === 'string')
            .map((engine) => ({
              categories: engine.categories ?? [],
              enabled: engine.enabled !== false,
              name: engine.name!,
              timeRangeSupport: engine.time_range_support === true,
            })),
        }
      }
    } catch {
      // The test page still works with its conservative static fallback.
    }
  }

  return NextResponse.json(
    {
      actions: availableActions,
      message: 'Web search API',
      providers: SEARCH_IMPL_TYPES,
      searxng,
    },
    { status: 200 }
  )
}
