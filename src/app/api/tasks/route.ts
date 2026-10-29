import { NextResponse } from 'next/server'
import { taskInputSchema } from '@/libs/tasks/schema'
import { taskRoute } from '@/server/tasks/http'
import { createTask, listTasks } from '@/server/tasks/service'

/** GET /api/tasks — 列出当前账号的定时任务。 */
export const GET = taskRoute(async (_request, { userId }) => NextResponse.json(await listTasks(userId)))

/** POST /api/tasks — 创建任务并安排下一个未来排期，不立即执行。 */
export const POST = taskRoute(async (request, { userId }) => {
  const input = taskInputSchema.parse(await request.json())
  return NextResponse.json(await createTask(userId, input), { status: 201 })
})
