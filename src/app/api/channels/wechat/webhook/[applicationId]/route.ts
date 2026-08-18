import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ingestWechatWebhookBatch } from '@/libs/channels/wechat/webhook'
import { authorizeWechatWebhook } from '@/libs/channels/wechat/webhookAuth'

export const runtime = 'nodejs'

const messageItemSchema = z.looseObject({
  file_item: z.record(z.string(), z.unknown()).optional(),
  image_item: z.record(z.string(), z.unknown()).optional(),
  text_item: z.looseObject({ text: z.string().max(40_000) }).optional(),
  type: z.number().optional(),
})

const rawMessageSchema = z.looseObject({
  client_id: z.union([z.string(), z.number()]).transform(String),
  context_token: z.string().max(8192).default(''),
  create_time_ms: z.number().optional().default(0),
  from_user_id: z.string().max(255),
  item_list: z.array(messageItemSchema).max(32).default([]),
  message_id: z.union([z.number(), z.string()]).transform(Number),
  message_state: z.number().default(2),
  message_type: z.number().default(1),
  to_user_id: z.string().max(255).default(''),
})

const batchSchema = z.looseObject({
  get_updates_buf: z.string().max(64_000).optional(),
  msgs: z.array(rawMessageSchema).max(100).default([]),
})

type RouteContext = { params: Promise<{ applicationId: string }> }

/**
 * POST /api/channels/wechat/webhook/[applicationId]
 * 微信 Gateway / 推送批量入站消息
 * @param request - JSON `{ msgs, get_updates_buf? }`；需通过 webhook 鉴权
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeWechatWebhook(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { applicationId: raw } = await context.params
  const applicationId = decodeURIComponent(raw || '').trim()
  if (!applicationId) return NextResponse.json({ error: 'Invalid applicationId' }, { status: 400 })
  const parsed = batchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
  const binding = await new ChannelBindingModel().findByApplicationId(WECHAT_PLATFORM, applicationId)
  if (!binding?.enabled) return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
  const accepted = await ingestWechatWebhookBatch(binding, {
    cursor: parsed.data.get_updates_buf,
    messages: parsed.data.msgs as WechatRawMessage[],
  })
  return NextResponse.json({ accepted: accepted.length }, { status: 202 })
}
