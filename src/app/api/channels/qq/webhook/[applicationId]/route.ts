import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { QQ_OP_CODES, signWebhookResponse } from '@pure/chat-adapter/qq'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { getOrCreateQQChat } from '@/libs/channels/qq/chatBot'
import { decryptCredentials } from '@/libs/channels/qq/encrypt'
import { authorizeQQInternalWebhook } from '@/libs/channels/qq/webhookAuth'
import { logger } from '@/libs/logger'

export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ applicationId: string }> }

type QQWebhookProbe = {
  d?: {
    event_ts?: unknown
    plain_token?: unknown
  }
  op?: unknown
}

async function probeQQWebhook(request: NextRequest): Promise<QQWebhookProbe | null> {
  try {
    const payload = await request.clone().json()
    return payload && typeof payload === 'object' ? (payload as QQWebhookProbe) : null
  } catch {
    return null
  }
}

/**
 * POST /api/channels/qq/webhook/[applicationId]
 * QQ 开放平台推送（webhook）或 Gateway 转发（websocket）
 *
 * 鉴权：若带 `Authorization` 则校验 Bearer（内部 Gateway）；
 * QQ 平台回调通常不带 Authorization；op=13 在初始化 Chat 前直接签名响应。
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { applicationId } = await context.params
  if (!applicationId?.trim()) {
    return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
  }

  try {
    const model = new ChannelBindingModel()
    const binding = await model.findByApplicationId(QQ_PLATFORM, applicationId)
    if (!binding || !binding.enabled) {
      return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
    }

    const credentials = decryptCredentials(binding.credentials)
    if (credentials.connectionMode === 'websocket' && !authorizeQQInternalWebhook(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await probeQQWebhook(request)
    if (payload?.op === QQ_OP_CODES.VERIFY) {
      const eventTs = payload.d?.event_ts
      const plainToken = payload.d?.plain_token
      if (typeof eventTs !== 'string' || !eventTs || typeof plainToken !== 'string' || !plainToken) {
        return new NextResponse('Missing verification data', { status: 400 })
      }

      return NextResponse.json({
        plain_token: plainToken,
        signature: signWebhookResponse(eventTs, plainToken, credentials.appSecret),
      })
    }

    const chat = await getOrCreateQQChat({
      agentId: binding.agentId,
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      applicationId: binding.applicationId,
      model: binding.model,
      provider: binding.provider,
      userId: binding.userId,
    })

    await model.touchActive(binding.id)

    const response = await chat.webhooks.qq(request, { waitUntil })
    return response
  } catch (error) {
    logger.error({ applicationId, error }, 'qq webhook failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
