import { NextResponse } from 'next/server'
import { taskRequestIdSchema } from '@/libs/tasks/schema'
import { taskRoute } from '@/server/tasks/http'
import { runTaskNow } from '@/server/tasks/service'

/** POST /api/tasks/[id]/run — 手动排队；相同 requestId 或已有未完成运行时返回已有记录。 */
export const POST = taskRoute<{ id: string }>(async (request, { params, userId }) => {
  const { id } = await params
  const { requestId } = taskRequestIdSchema.parse(await request.json())
  return NextResponse.json(await runTaskNow(userId, id, requestId), { status: 202 })
})
