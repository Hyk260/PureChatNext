import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatToolApprovalModel } from '@pure/database/models/chatToolApproval'
import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const updateSchema = z.object({
  error: z.string().max(2000).optional(),
  status: z.enum(['approved', 'denied', 'completed', 'failed']),
})

export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id, toolCallId } = await params
  const topic = await new ChatTopicModel(userId).findById(id)
  if (!topic) return jsonError('Topic not found', 404)
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return jsonError(parsed.error.message)
  const approval = await new ChatToolApprovalModel(userId).updateStatus(
    id,
    toolCallId,
    parsed.data.status,
    parsed.data.error
  )
  if (!approval) return jsonError('Tool approval not found', 404)
  return NextResponse.json(approval)
})
