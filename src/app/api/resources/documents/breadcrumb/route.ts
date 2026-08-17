import { NextResponse } from 'next/server'

import { DocumentModel } from '@pure/database/models/document'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

/**
 * GET /api/resources/documents/breadcrumb
 * 按 slug 路径获取文件夹面包屑
 * @param request - query `slugPath` 必填（`/` 分隔）
 */
export const GET = withAuth(async (request, { userId }) => {
  const slugPath = request.nextUrl.searchParams.get('slugPath')
  if (!slugPath) return jsonError('slugPath is required')

  const breadcrumbs = await new DocumentModel(userId).getFolderBreadcrumb(slugPath.split('/'))
  return NextResponse.json(breadcrumbs)
})
