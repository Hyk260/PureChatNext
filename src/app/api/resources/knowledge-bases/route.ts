import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeBaseModel } from '@pure/database/models/knowledgeBase'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const createSchema = z.object({
  avatar: z.string().optional(),
  description: z.string().optional(),
  name: z.string().min(1),
})

/**
 * GET /api/resources/knowledge-bases
 * 列出当前用户的知识库
 */
export const GET = withAuth(async (_request, { userId }) => {
  try {
    const items = await new KnowledgeBaseModel(userId).list()
    return NextResponse.json(items)
  } catch (error) {
    const pgCode = (error as { cause?: { code?: string } })?.cause?.code
    console.error('[resources/knowledge-bases] GET failed:', error)
    return NextResponse.json(
      {
        error: pgCode === '42P01' ? 'Database tables not migrated. Run: pnpm db:migrate' : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
})

/**
 * POST /api/resources/knowledge-bases
 * 创建知识库
 * @param request - JSON `{ name, avatar?, description? }`
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new KnowledgeBaseModel(userId).create(parsed.data)
  return NextResponse.json(item)
})
