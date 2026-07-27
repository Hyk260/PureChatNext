import { NextResponse } from 'next/server'

import { DocumentModel } from '@pure/database/models/document'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

export const GET = withAuth(async (request, { userId }) => {
  const slugPath = request.nextUrl.searchParams.get('slugPath')
  if (!slugPath) return jsonError('slugPath is required')

  const breadcrumbs = await new DocumentModel(userId).getFolderBreadcrumb(slugPath.split('/'))
  return NextResponse.json(breadcrumbs)
})
