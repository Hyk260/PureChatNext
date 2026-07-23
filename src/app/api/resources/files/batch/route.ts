import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeRepo } from '@/database/repositories/knowledge'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const batchSchema = z.object({
  action: z.enum(['delete']),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sourceType: z.enum(['file', 'document']),
      })
    )
    .min(1),
})

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  if (parsed.data.action === 'delete') {
    await new KnowledgeRepo(userId).deleteMany(parsed.data.items)
    return NextResponse.json({ deleted: parsed.data.items.length })
  }

  return jsonError('Unsupported action')
})
