import debug from 'debug'
import { ZodError } from 'zod'
import { TaskConflictError } from '@pure/database/models/task'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import type { AuthRouteContext } from '@/libs/auth/get-session-user'
import type { NextRequest } from 'next/server'

import { TaskServiceError } from './errors'

const log = debug('tasks:api')

export function taskRoute<P extends Record<string, string> = Record<string, string>>(
  handler: (request: NextRequest, context: AuthRouteContext<P>) => Promise<Response>
) {
  return withAuth<P>(async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof ZodError) return jsonError(error.issues[0]?.message || '任务参数无效')
      if (error instanceof TaskServiceError) return jsonError(error.message, error.status)
      if (error instanceof TaskConflictError) return jsonError(error.message, 409)
      if (error instanceof SyntaxError) return jsonError('请求 JSON 格式无效')
      log('request failed method=%s path=%s', request.method, request.nextUrl.pathname)
      return jsonError('任务服务暂时不可用，请稍后重试', 503)
    }
  })
}
