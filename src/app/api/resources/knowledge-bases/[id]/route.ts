import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { KnowledgeBaseModel } from '@/database/models/knowledgeBase'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const updateSchema = z.object({
  avatar: z.string().optional(),
  description: z.string().optional(),
  name: z.string().min(1).optional(),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const item = await new KnowledgeBaseModel(userId).findById(id)
  if (!item) return jsonError('Knowledge base not found', 404)

  return NextResponse.json(item)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new KnowledgeBaseModel(userId).update(id, parsed.data)
  if (!item) return jsonError('Knowledge base not found', 404)

  return NextResponse.json(item)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  await new KnowledgeBaseModel(userId).delete(id)
  return NextResponse.json({ success: true })
}
