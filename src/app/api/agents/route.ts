import { NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { AgentConfigurationError, AgentService } from '@/server/agents/service'

const createSchema = z.object({
  avatar: z.string().optional(),
  backgroundColor: z.string().optional(),
  description: z.string().optional(),
  marketIdentifier: z.string().min(1).optional(),
  model: z.string().optional(),
  openingMessage: z.string().nullable().optional(),
  openingQuestions: z.array(z.string()).nullable().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  pinned: z.boolean().optional(),
  provider: z.string().optional(),
  sort: z.number().int().optional(),
  systemRole: z.string().optional(),
  title: z.string().min(1).optional(),
})

/**
 * GET /api/agents
 * 列出当前用户可见的 Agent
 */
export const GET = withAuth(async (_request, { userId }) => {
  try {
    const items = await new AgentService(userId).listVisible()
    return NextResponse.json(items, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[api/agents] GET failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

/**
 * POST /api/agents
 * 创建 Agent
 * @param request - 社区助理仅传 marketIdentifier；自定义助理 title 必填
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const { marketIdentifier, title, ...input } = parsed.data
  const service = new AgentService(userId)
  try {
    if (marketIdentifier) return NextResponse.json(await service.install(marketIdentifier))
    if (!title) return jsonError('title is required')
    return NextResponse.json(await service.create({ ...input, title }))
  } catch (error) {
    if (error instanceof AgentConfigurationError) return jsonError(error.message, error.status)
    throw error
  }
})
