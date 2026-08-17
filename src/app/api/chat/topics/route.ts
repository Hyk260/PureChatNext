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

/**
 * GET /api/chat/topics
 * 按 Agent 列出会话 Topic
 * @param request - query `agentId` 必填
 */
export const GET = withAuth(async (request, { userId }) => {
  const agentId = request.nextUrl.searchParams.get('agentId')
  if (!agentId) return jsonError('agentId is required')

  const items = await new ChatTopicModel(userId).listByAgent(agentId)
  return NextResponse.json(items)
})

/**
 * POST /api/chat/topics
 * 创建会话 Topic
 * @param request - JSON `{ agentId, title? }`
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new ChatTopicModel(userId).create(parsed.data)
  return NextResponse.json(item)
})

/**
 * DELETE /api/chat/topics
 * 按 Agent 批量删除 Topic
 * @param request - query `agentId` + `scope=all|unfavorited`
 */
export const DELETE = withAuth(async (request, { userId }) => {
  const parsed = deleteSchema.safeParse({
    agentId: request.nextUrl.searchParams.get('agentId'),
    scope: request.nextUrl.searchParams.get('scope'),
  })
  if (!parsed.success) return jsonError(parsed.error.message)

  const deleted = await new ChatTopicModel(userId).deleteByAgent(parsed.data.agentId, parsed.data.scope)
  return NextResponse.json({ deletedIds: deleted.map((item) => item.id) })
})
