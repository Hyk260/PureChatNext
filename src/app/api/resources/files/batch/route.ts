import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeRepo } from '@/database/repositories/knowledge'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const batchSchema = z.object({
  action: z.enum(['delete']),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sourceType: z.enum(['file', 'document']),
      }),
    )
    .min(1),
})

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const body = await request.json()
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  if (parsed.data.action === 'delete') {
    await new KnowledgeRepo(userId).deleteMany(parsed.data.items)
    return NextResponse.json({ deleted: parsed.data.items.length })
  }

  return jsonError('Unsupported action')
}
