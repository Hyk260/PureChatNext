import { NextResponse } from 'next/server'
import { taskRoute } from '@/server/tasks/http'
import { retryTaskDelivery } from '@/server/tasks/service'

/** POST /api/tasks/[id]/deliveries/[deliveryId]/retry — 重投已保存结果，不重新执行助理。 */
export const POST = taskRoute<{ id: string; deliveryId: string }>(async (_request, { params, userId }) => {
  const { id, deliveryId } = await params
  return NextResponse.json(await retryTaskDelivery(userId, id, deliveryId))
})
