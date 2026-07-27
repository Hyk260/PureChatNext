import { NextResponse } from 'next/server'
import { z } from 'zod'

import { AgentDeleteError, AgentModel } from '@pure/database/models/agent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

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

export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const item = await new AgentModel(userId).findVisibleById(id)
  if (!item) return jsonError('Agent not found', 404)

  return NextResponse.json(item)
})

export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new AgentModel(userId).update(id, parsed.data)
  if (!item) return jsonError('Agent not found', 404)

  return NextResponse.json(item)
})

export const DELETE = withAuth(async (_request, { params, userId }) => {
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
})
