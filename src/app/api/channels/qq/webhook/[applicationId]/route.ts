import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { QQ_OP_CODES, signWebhookResponse, verifyWebhookSignature } from '@pure/chat-adapter/qq'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
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

async function readQQWebhookBody(
  request: NextRequest
): Promise<{ bodyText: string; payload: QQWebhookProbe | null }> {
  const bodyText = await request.clone().text()

  try {
    const payload: unknown = JSON.parse(bodyText)
    return {
      bodyText,
      payload: payload && typeof payload === 'object' ? (payload as QQWebhookProbe) : null,
    }
  } catch {
    return { bodyText, payload: null }
  }
}

/**
 * POST /api/channels/qq/webhook/[applicationId]
 * QQ 开放平台推送（webhook）或 Gateway 转发（websocket）
 *
 * 鉴权：websocket 内部 Gateway 校验 Bearer；webhook 事件校验 QQ Ed25519 签名；
 * op=13 在事件验签和初始化 Chat 前直接签名响应。
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

    const { bodyText, payload } = await readQQWebhookBody(request)
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

    if (credentials.connectionMode === 'webhook') {
      const signature = request.headers.get('X-Signature-Ed25519')
      const timestamp = request.headers.get('X-Signature-Timestamp')
      if (
        !signature ||
        !timestamp ||
        !verifyWebhookSignature(bodyText, timestamp, signature, credentials.appSecret)
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { getOrCreateQQChat } = await import('@/libs/channels/qq/chatBot')

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
