import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { AgentDeleteError, AgentModel } from '@/database/models/agent'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

const updateSchema = z.object({
  avatar: z.string().optional(),
  backgroundColor: z.string().optional(),
  description: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  pinned: z.boolean().optional(),
  provider: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  sort: z.number().int().optional(),
  systemRole: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const item = await new AgentModel(userId).findVisibleById(id)
  if (!item) return jsonError('Agent not found', 404)

  return NextResponse.json(item)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new AgentModel(userId).update(id, parsed.data)
  if (!item) return jsonError('Agent not found', 404)

  return NextResponse.json(item)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params

  try {
    await new AgentModel(userId).delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AgentDeleteError) {
      if (error.code === 'builtin') return jsonError(error.message, 403)
      if (error.code === 'has_topics') return jsonError(error.message, 409)
      return jsonError(error.message, 404)
    }
    throw error
  }
}
