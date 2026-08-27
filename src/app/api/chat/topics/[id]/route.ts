import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { CHAT_PERMISSION_MODES } from '@pure/types'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const updateSchema = z
  .object({
    favorite: z.boolean().optional(),
    permissionMode: z.enum(CHAT_PERMISSION_MODES).optional(),
    projectName: z.string().trim().nullable().optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.favorite !== undefined ||
      value.permissionMode !== undefined ||
      value.projectName !== undefined ||
      value.title !== undefined,
    'At least one field is required'
  )

/**
 * PATCH /api/chat/topics/[id]
 * 更新 Topic（标题 / 收藏 / 项目名 / 权限模式）
 * @param request - JSON body（至少一项字段）
 */
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

/**
 * DELETE /api/chat/topics/[id]
 * 删除单个 Topic
 */
export const DELETE = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const topicModel = new ChatTopicModel(userId)
  const topic = await topicModel.findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  await topicModel.delete(id)
  return NextResponse.json({ success: true })
})
