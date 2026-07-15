import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatTopicModel } from '@/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const updateSchema = z.object({
  title: z.string().min(1),
})

export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new ChatTopicModel(userId).updateTitle(id, parsed.data.title)
  if (!item) return jsonError('Topic not found', 404)

  return NextResponse.json(item)
})

export const DELETE = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const topicModel = new ChatTopicModel(userId)
  const topic = await topicModel.findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  await topicModel.delete(id)
  return NextResponse.json({ success: true })
})
