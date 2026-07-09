import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeBaseModel } from '@/database/models/knowledgeBase'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const schema = z.object({
  action: z.enum(['add', 'remove']),
  fileIds: z.array(z.string()).min(1),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

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
}
