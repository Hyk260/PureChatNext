import type { UIMessage } from 'ai'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatMessageModel } from '@/database/models/chatMessage'
import { ChatTopicModel } from '@/database/models/chatTopic'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const uiMessageSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  parts: z.array(z.unknown()),
})

const replaceMessagesSchema = z.object({
  messages: z.array(uiMessageSchema),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const topic = await new ChatTopicModel(userId).findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  const messages = await new ChatMessageModel(userId).listByTopic(id)
  return NextResponse.json(messages)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const body = await request.json()
  const parsed = replaceMessagesSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  try {
    await new ChatMessageModel(userId).replaceAll(id, parsed.data.messages as UIMessage[])
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Topic not found') {
      return jsonError('Topic not found', 404)
    }
    throw error
  }
}
