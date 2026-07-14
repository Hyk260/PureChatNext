import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatTopicModel } from '@/database/models/chatTopic'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const updateSchema = z.object({
  title: z.string().min(1),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new ChatTopicModel(userId).updateTitle(id, parsed.data.title)
  if (!item) return jsonError('Topic not found', 404)

  return NextResponse.json(item)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const topicModel = new ChatTopicModel(userId)
  const topic = await topicModel.findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  await topicModel.delete(id)
  return NextResponse.json({ success: true })
}
