import { NextResponse } from 'next/server'

import { KnowledgeRepo } from '@/database/repositories/knowledge'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { QueryFileListSchema } from '@/types/files'

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
      items: sliced.map((item) => repo.toFileListItem(item)),
    })
  } catch (error) {
    const pgCode = (error as { cause?: { code?: string } })?.cause?.code
    console.error('[resources/items] GET failed:', error)
    return NextResponse.json(
      {
        error:
          pgCode === '42P01'
            ? 'Database tables not migrated. Run: pnpm db:migrate'
            : 'Internal Server Error',
      },
      { status: 500 },
    )
  }
})
