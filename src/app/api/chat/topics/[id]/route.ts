import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const updateSchema = z
  .object({
    favorite: z.boolean().optional(),
    projectName: z.string().trim().nullable().optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => value.favorite !== undefined || value.projectName !== undefined || value.title !== undefined,
    'At least one field is required'
  )

export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const patch = {
    ...parsed.data,
    ...(parsed.data.projectName !== undefined ? { projectName: parsed.data.projectName?.trim() || null } : {}),
  }
  const item = await new ChatTopicModel(userId).update(id, patch)
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
