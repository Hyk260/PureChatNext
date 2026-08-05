import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ingestWechatRawMessage } from '@/libs/channels/wechat/poller'
import { authorizeWechatWebhook } from '@/libs/channels/wechat/webhookAuth'

const rawMessageSchema = z.object({
  client_id: z.string().max(255),
  context_token: z.string().max(8192),
  create_time_ms: z.number(),
  from_user_id: z.string().max(255),
  item_list: z.array(z.object({ text_item: z.object({ text: z.string().max(40_000) }).optional(), type: z.number() }).passthrough()).max(16),
  message_id: z.number(),
  message_state: z.number(),
  message_type: z.number(),
  to_user_id: z.string().max(255),
})

type RouteContext = { params: Promise<{ applicationId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeWechatWebhook(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { applicationId: raw } = await context.params
  const applicationId = decodeURIComponent(raw || '').trim()
  if (!applicationId) return NextResponse.json({ error: 'Invalid applicationId' }, { status: 400 })
  const parsed = rawMessageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  const binding = await new ChannelBindingModel().findByApplicationId(WECHAT_PLATFORM, applicationId)
  if (!binding?.enabled) return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
  await ingestWechatRawMessage(binding, parsed.data)
  return NextResponse.json({ accepted: true }, { status: 202 })
}
