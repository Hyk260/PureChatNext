import { NextResponse } from 'next/server'
import { taskPatchSchema } from '@/libs/tasks/schema'
import { taskRoute } from '@/server/tasks/http'
import { getTask, updateTask } from '@/server/tasks/service'

/** GET /api/tasks/[id] — 读取当前账号的任务详情。 */
export const GET = taskRoute<{ id: string }>(async (_request, { params, userId }) => {
  const { id } = await params
  return NextResponse.json(await getTask(userId, id))
})

/** PATCH /api/tasks/[id] — 修改配置、业务状态或定时开关，运行中的快照不受影响。 */
export const PATCH = taskRoute<{ id: string }>(async (request, { params, userId }) => {
  const { id } = await params
  const patch = taskPatchSchema.parse(await request.json())
  return NextResponse.json(await updateTask(userId, id, patch))
})
