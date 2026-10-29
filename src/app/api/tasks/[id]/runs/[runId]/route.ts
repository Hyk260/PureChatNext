import { NextResponse } from 'next/server'
import { taskRoute } from '@/server/tasks/http'
import { deleteTaskRun, getTaskRun } from '@/server/tasks/service'

/** GET /api/tasks/[id]/runs/[runId] — 通知详情链接读取指定运行，不依赖分页位置。 */
export const GET = taskRoute<{ id: string; runId: string }>(async (_request, { params, userId }) => {
  const { id, runId } = await params
  return NextResponse.json(await getTaskRun(userId, id, runId))
})

/** DELETE /api/tasks/[id]/runs/[runId] — 删除已结束的运行记录及其投递记录。 */
export const DELETE = taskRoute<{ id: string; runId: string }>(async (_request, { params, userId }) => {
  const { id, runId } = await params
  return NextResponse.json(await deleteTaskRun(userId, id, runId))
})
