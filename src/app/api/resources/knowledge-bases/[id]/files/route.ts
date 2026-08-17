import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeBaseModel } from '@pure/database/models/knowledgeBase'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const schema = z.object({
  action: z.enum(['add', 'remove']),
  fileIds: z.array(z.string()).min(1),
})

/**
 * POST /api/resources/knowledge-bases/[id]/files
 * 向知识库批量添加或移除文件
 * @param request - JSON `{ action: 'add'|'remove', fileIds: string[] }`
 */
export const POST = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const model = new KnowledgeBaseModel(userId)
  const kb = await model.findById(id)
  if (!kb) return jsonError('Knowledge base not found', 404)

  if (parsed.data.action === 'add') {
    await model.addFiles(id, parsed.data.fileIds)
  } else {
    await model.removeFiles(id, parsed.data.fileIds)
  }

  return NextResponse.json({ success: true })
})
