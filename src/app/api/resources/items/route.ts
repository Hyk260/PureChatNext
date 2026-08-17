import { KnowledgeRepo } from '@pure/database/repositories/knowledge'
import { NextResponse } from 'next/server'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { resolveFileAccessUrl } from '@/server/modules/S3/url'
import { QueryFileListSchema } from '@/types/files'

/**
 * GET /api/resources/items
 * 查询当前用户的知识库文件 / 文档列表
 * @param request - query 见 `QueryFileListSchema`
 */
export const GET = withAuth(async (request, { userId }) => {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = QueryFileListSchema.safeParse(params)
  if (!parsed.success) return jsonError(parsed.error.message)

  try {
    const repo = new KnowledgeRepo(userId)
    const limit = parsed.data.limit ?? 50
    const items = await repo.query(parsed.data)
    const hasMore = items.length > limit
    const sliced = hasMore ? items.slice(0, limit) : items

    return NextResponse.json({
      hasMore,
      items: sliced.map((item) => {
        const fileListItem = repo.toFileListItem(item)
        if (item.sourceType === 'file' && item.url) {
          fileListItem.url = resolveFileAccessUrl(item.id, item.url)
        }
        return fileListItem
      }),
    })
  } catch (error) {
    const pgCode = (error as { cause?: { code?: string } })?.cause?.code
    console.error('[resources/items] GET failed:', error)
    return NextResponse.json(
      {
        error: pgCode === '42P01' ? 'Database tables not migrated. Run: pnpm db:migrate' : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
})
