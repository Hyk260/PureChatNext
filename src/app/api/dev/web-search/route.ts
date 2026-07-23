import { type CrawlImplType } from '@pure/web-crawler'

import { NextResponse } from 'next/server'

import { searchService } from '@/server/search'

type WebSearchAction = 'query' | 'webSearch' | 'crawlPages'

const availableActions: WebSearchAction[] = ['query', 'webSearch', 'crawlPages']

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const stringArrayOrUndefined = (value: unknown) => {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

const stringOrUndefined = (value: unknown) => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

const badRequest = (error: string) => {
  return NextResponse.json({ error, success: false }, { status: 400 })
}

const success = (action: WebSearchAction, result: unknown) => {
  return NextResponse.json({ action, result, success: true }, { status: 200 })
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
    return badRequest('Invalid JSON body')
  }

  if (!isRecord(body)) {
    return badRequest('Request body must be an object')
  }

  const rawAction = body.action

  if (typeof rawAction !== 'string' || !availableActions.includes(rawAction as WebSearchAction)) {
    return badRequest(`Invalid action. Available actions: ${availableActions.join(', ')}`)
  }

  const action = rawAction as WebSearchAction

  try {
    if (action === 'query') {
      const query = stringOrUndefined(body.query)

      if (!query) {
        return badRequest('Missing or invalid "query" field')
      }

      const rawParams = isRecord(body.params) ? body.params : {}
      const result = await searchService.query(query, {
        searchCategories: stringArrayOrUndefined(rawParams.searchCategories),
        searchEngines: stringArrayOrUndefined(rawParams.searchEngines),
        searchTimeRange: stringOrUndefined(rawParams.searchTimeRange),
      })

      return success(action, result)
    }

    if (action === 'webSearch') {
      const query = stringOrUndefined(body.query)

      if (!query) {
        return badRequest('Missing or invalid "query" field')
      }

      const result = await searchService.webSearch({
        query,
        searchCategories: stringArrayOrUndefined(body.searchCategories),
        searchEngines: stringArrayOrUndefined(body.searchEngines),
        searchTimeRange: stringOrUndefined(body.searchTimeRange),
      })

      return success(action, result)
    }

    const urls = stringArrayOrUndefined(body.urls) ?? []

    if (urls.length === 0) {
      return badRequest('Missing or invalid "urls" field')
    }

    const result = await searchService.crawlPages({
      impls: stringArrayOrUndefined(body.impls) as CrawlImplType[] | undefined,
      urls,
    })

    return success(action, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'

    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

/**
 * 联网搜索测试 API（仅开发环境）
 * GET /api/dev/web-search
 */
export const GET = async () => {
  return NextResponse.json(
    {
      actions: availableActions,
      message: 'Web search API',
    },
    { status: 200 }
  )
}
