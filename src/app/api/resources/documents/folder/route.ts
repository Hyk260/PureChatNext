import { NextResponse } from 'next/server'
import { z } from 'zod'

import { DocumentModel } from '@pure/database/models/document'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const schema = z.object({
  knowledgeBaseId: z.string().optional(),
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
})

/**
 * POST /api/resources/documents/folder
 * 创建文档文件夹
 * @param request - JSON `{ name, knowledgeBaseId?, parentId? }`
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const folder = await new DocumentModel(userId).createFolder(parsed.data)
  return NextResponse.json(folder)
})
