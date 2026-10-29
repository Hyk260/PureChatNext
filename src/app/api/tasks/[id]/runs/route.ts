import { NextResponse } from 'next/server'
import { z } from 'zod'
import { taskRoute } from '@/server/tasks/http'
import { getTaskRuns } from '@/server/tasks/service'

/** GET /api/tasks/[id]/runs — 按时间游标读取运行历史。 */
export const GET = taskRoute<{ id: string }>(async (request, { params, userId }) => {
  const { id } = await params
  const raw = request.nextUrl.searchParams.get('before')
  const before = raw ? z.string().min(1).max(128).parse(raw) : undefined
  return NextResponse.json(await getTaskRuns(userId, id, before))
})
