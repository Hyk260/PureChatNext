import { toNextJsHandler } from 'better-auth/next-js'
import debug from 'debug'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'

const log = debug('better-auth:*')

const jsonContentTypeRegex = /^application\/(?:[a-z0-9.+-]*\+)?json/i

const handler = toNextJsHandler(auth)

const malformedJsonResponse = () =>
  Response.json({ code: 'INVALID_JSON', message: 'Malformed JSON request body' }, { status: 400 })

/**
 * better-call currently treats Request.json() SyntaxError as a server error.
 * Validate JSON bodies at the route boundary so malformed client payloads stay 400s.
 */
const validateJsonBody = async (request: Request) => {
  const contentType = request.headers.get('content-type') || ''
  if (!request.body || !jsonContentTypeRegex.test(contentType)) return

  try {
    await request.clone().json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      log('malformed JSON body: content-type=%s url=%s', contentType, request.url)
      return malformedJsonResponse()
    }
    throw error
  }
}

/**
 * GET /api/auth/[...all]
 * better-auth 捕获路由（会话 / OAuth 等 GET）
 */
export const GET = async (request: NextRequest) => {
  // log('GET %s', request.url);
  return handler.GET(request)
}

/**
 * POST /api/auth/[...all]
 * better-auth 捕获路由（登录 / 注册等 POST）；非法 JSON 在边界返回 400
 */
export const POST = async (request: NextRequest) => {
  log('POST %s content-type=%s', request.url, request.headers.get('content-type') || '')

  const invalidJsonResponse = await validateJsonBody(request)
  if (invalidJsonResponse) return invalidJsonResponse

  return handler.POST(request)
}
