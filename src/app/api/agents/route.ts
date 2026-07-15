import { NextResponse } from 'next/server'
import { z } from 'zod'

import { AgentModel } from '@/database/models/agent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const createSchema = z.object({
  avatar: z.string().optional(),
  backgroundColor: z.string().optional(),
  description: z.string().optional(),
  marketIdentifier: z.string().min(1).optional(),
  model: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  pinned: z.boolean().optional(),
  provider: z.string().optional(),
  sort: z.number().int().optional(),
  systemRole: z.string().optional(),
  title: z.string().min(1),
})

export const GET = withAuth(async (_request, { userId }) => {
  try {
    const items = await new AgentModel(userId).listVisible()
    return NextResponse.json(items)
  } catch (error) {
    console.error('[api/agents] GET failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const item = await new AgentModel(userId).create(parsed.data)
  return NextResponse.json(item)
})
