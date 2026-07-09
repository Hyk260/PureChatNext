import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { DocumentModel } from '@/database/models/document'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const schema = z.object({
  knowledgeBaseId: z.string().optional(),
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const folder = await new DocumentModel(userId).createFolder(parsed.data)
  return NextResponse.json(folder)
}
