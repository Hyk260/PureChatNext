import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ChatToolApprovalModel } from '@pure/database/models/chatToolApproval'
import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const createSchema = z.object({
  apiName: z.string().min(1).max(200),
  args: z.record(z.string(), z.unknown()),
  argsHash: z.string().regex(/^[a-f0-9]{64}$/),
  identifier: z.string().min(1).max(200),
  toolCallId: z.string().min(1).max(200),
})

const hashArgs = (args: Record<string, unknown>) => createHash('sha256').update(JSON.stringify(args)).digest('hex')

export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const topic = await new ChatTopicModel(userId).findById(id)
  if (!topic) return jsonError('Topic not found', 404)
  return NextResponse.json(await new ChatToolApprovalModel(userId).listPending(id))
})

export const POST = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const topic = await new ChatTopicModel(userId).findById(id)
  if (!topic) return jsonError('Topic not found', 404)
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) return jsonError(parsed.error.message)
  if (hashArgs(parsed.data.args) !== parsed.data.argsHash) return jsonError('Arguments hash mismatch', 400)
  const approval = await new ChatToolApprovalModel(userId).upsertPending({ ...parsed.data, topicId: id })
  return NextResponse.json(approval)
})
