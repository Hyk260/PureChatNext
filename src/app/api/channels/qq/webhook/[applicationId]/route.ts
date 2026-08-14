import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { getOrCreateQQChat } from '@/libs/channels/qq/chatBot'
import { decryptCredentials } from '@/libs/channels/qq/encrypt'
import { authorizeQQInternalWebhook } from '@/libs/channels/qq/webhookAuth'
import { logger } from '@/libs/logger'

export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ applicationId: string }> }

/**
 * POST /api/channels/qq/webhook/[applicationId]
 * QQ Open Platform push (webhook mode) or gateway forward (websocket mode).
 *
 * Auth: if `Authorization` is present, require Bearer (internal gateway).
 * QQ Open Platform callbacks omit Authorization; Ed25519 verify is handled in adapter (op=13).
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
