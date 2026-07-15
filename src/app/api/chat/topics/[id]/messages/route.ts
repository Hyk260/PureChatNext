import type { UIMessage } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatMessageModel } from '@/database/models/chatMessage'
import { ChatTopicModel } from '@/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const uiMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.unknown()),
})

const replaceMessagesSchema = z.object({
  messages: z.array(uiMessageSchema),
})

export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const topic = await new ChatTopicModel(userId).findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  const messages = await new ChatMessageModel(userId).listByTopic(id)
  return NextResponse.json(messages)
})

export const PUT = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const topic = await new ChatTopicModel(userId).findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  const body = await request.json()
  const parsed = replaceMessagesSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  await new ChatMessageModel(userId).replaceAll(id, parsed.data.messages as UIMessage[])
  return NextResponse.json({ success: true })
})
