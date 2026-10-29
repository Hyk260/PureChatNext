import { NextResponse } from 'next/server'
import { taskRoute } from '@/server/tasks/http'
import { stopTaskRun } from '@/server/tasks/service'

/** POST /api/tasks/[id]/runs/[runId]/stop — 停止本次运行，不修改未来排期。 */
export const POST = taskRoute<{ id: string; runId: string }>(async (_request, { params, userId }) => {
  const { id, runId } = await params
  return NextResponse.json(await stopTaskRun(userId, id, runId))
})
