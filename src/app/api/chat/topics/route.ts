import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const createSchema = z.object({
  agentId: z.string().min(1),
  title: z.string().min(1).optional(),
})

const deleteSchema = z.object({
  agentId: z.string().min(1),
  scope: z.enum(['all', 'unfavorited']),
})

export const GET = withAuth(async (request, { userId }) => {
  const agentId = request.nextUrl.searchParams.get('agentId')
  if (!agentId) return jsonError('agentId is required')

  const items = await new ChatTopicModel(userId).listByAgent(agentId)
  return NextResponse.json(items)
})

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new ChatTopicModel(userId).create(parsed.data)
  return NextResponse.json(item)
})

export const DELETE = withAuth(async (request, { userId }) => {
  const parsed = deleteSchema.safeParse({
    agentId: request.nextUrl.searchParams.get('agentId'),
    scope: request.nextUrl.searchParams.get('scope'),
  })
  if (!parsed.success) return jsonError(parsed.error.message)

  const deleted = await new ChatTopicModel(userId).deleteByAgent(parsed.data.agentId, parsed.data.scope)
  return NextResponse.json({ deletedIds: deleted.map((item) => item.id) })
})
