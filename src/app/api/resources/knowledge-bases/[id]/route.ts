import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeBaseModel } from '@pure/database/models/knowledgeBase'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const updateSchema = z.object({
  avatar: z.string().optional(),
  description: z.string().optional(),
  name: z.string().min(1).optional(),
})

/**
 * GET /api/resources/knowledge-bases/[id]
 * 获取单个知识库
 */
export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const item = await new KnowledgeBaseModel(userId).findById(id)
  if (!item) return jsonError('Knowledge base not found', 404)

  return NextResponse.json(item)
})

/**
 * PATCH /api/resources/knowledge-bases/[id]
 * 更新知识库
 * @param request - JSON `{ name?, avatar?, description? }`
 */
export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new KnowledgeBaseModel(userId).update(id, parsed.data)
  if (!item) return jsonError('Knowledge base not found', 404)

  return NextResponse.json(item)
})

/**
 * DELETE /api/resources/knowledge-bases/[id]
 * 删除知识库
 */
export const DELETE = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  await new KnowledgeBaseModel(userId).delete(id)
  return NextResponse.json({ success: true })
})
