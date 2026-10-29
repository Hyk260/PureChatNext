import { NextResponse } from 'next/server'
import { taskRoute } from '@/server/tasks/http'
import { taskRuntime } from '@/server/tasks/service'

/** GET /api/tasks/runtime — 调度心跳与本人渠道状态，不包含凭据。 */
export const GET = taskRoute(async (_request, { userId }) => NextResponse.json(await taskRuntime(userId)))
