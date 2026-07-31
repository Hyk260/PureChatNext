import type { UIMessage } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatMessageModel } from '@pure/database/models/chatMessage'
import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const uiMessageSchema = z.object({
  id: z.string().min(1),
  metadata: z
    .object({
      model: z.string().min(1).max(256).optional(),
      performance: z
        .object({
          duration: z.number().finite().optional(),
          latency: z.number().finite().optional(),
          tps: z.number().finite().optional(),
          ttft: z.number().finite().optional(),
        })
        .optional(),
      provider: z.string().min(1).max(128).optional(),
      reasoning: z
        .object({
          duration: z.number().finite().nonnegative().optional(),
        })
        .optional(),
      usage: z.record(z.string(), z.number().finite()).optional(),
    })
    .optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.unknown()),
})

export const replaceMessagesSchema = z.object({
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
