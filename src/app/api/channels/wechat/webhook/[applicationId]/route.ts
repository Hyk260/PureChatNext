import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { getOrCreateWechatChat } from '@/libs/channels/wechat/chatBot'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { authorizeWechatWebhook } from '@/libs/channels/wechat/webhookAuth'
import { logger } from '@/libs/logger'

export const maxDuration = 300

type RouteContext = { params: Promise<{ applicationId: string }> }

/**
 * POST /api/channels/wechat/webhook/[applicationId]
 * Gateway forwards raw iLink messages here; Chat SDK WechatAdapter handles them.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeWechatWebhook(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { applicationId: rawApplicationId } = await context.params
  const applicationId = (() => {
    const trimmed = rawApplicationId?.trim()
    if (!trimmed) return ''
    try {
      return decodeURIComponent(trimmed)
    } catch {
      return trimmed
    }
  })()
  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
  }

  try {
    const model = new ChannelBindingModel()
    const binding = await model.findByApplicationId(WECHAT_PLATFORM, applicationId)
    if (!binding || !binding.enabled) {
      return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
    }

    const credentials = decryptCredentials(binding.credentials)
    const chat = await getOrCreateWechatChat({
      agentId: binding.agentId,
      applicationId: binding.applicationId,
      botId: credentials.botId || undefined,
      botToken: credentials.botToken,
      userId: binding.userId,
    })

    await model.touchActive(binding.id)

    const response = await chat.webhooks.wechat(request, { waitUntil })
    return response
  } catch (error) {
    logger.error({ applicationId, error }, 'wechat webhook failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
