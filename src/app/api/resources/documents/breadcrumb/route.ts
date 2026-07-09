import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { DocumentModel } from '@/database/models/document'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const slugPath = request.nextUrl.searchParams.get('slugPath')
  if (!slugPath) return jsonError('slugPath is required')

  const breadcrumbs = await new DocumentModel(userId).getFolderBreadcrumb(slugPath.split('/'))
  return NextResponse.json(breadcrumbs)
}
