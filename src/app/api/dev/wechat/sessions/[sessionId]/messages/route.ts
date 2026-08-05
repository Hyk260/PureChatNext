import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import {
  canSendWechatDevOutbound,
  sendWechatOutboundText,
  WechatOutboundError,
} from '@/libs/channels/wechat/outbound'
import { expandEventsToMessages } from '@/libs/channels/wechat/timeline'

const MAX_OUTBOUND_TEXT_LENGTH = 40_000

function resolveOwnerExternalUserId(credentials: string): string {
  try {
    return decryptCredentials(credentials).userId?.trim() || ''
  } catch {
    return ''
  }
}

export const GET = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam) ? limitParam : 50
  const afterParam = request.nextUrl.searchParams.get('after')
  let after: Date | undefined
  if (afterParam) {
    after = new Date(afterParam)
    if (Number.isNaN(after.getTime())) return jsonError('Invalid after timestamp')
  }

  const result = await new ChannelEventModel().listTimelineBySession(sessionId, {
    after,
    limit,
  })
  if (!result) return jsonError('Session not found', 404)

  const sessionBinding = await new ChannelBindingModel().findById(result.session.bindingId)
  if (!sessionBinding || sessionBinding.platform !== WECHAT_PLATFORM) {
    return jsonError('Session not found', 404)
  }

  const { events, session } = result
  const effectiveAgentId = session.activeAgentId || sessionBinding.agentId
  const agent = await new AgentModel(userId).findVisibleById(effectiveAgentId)
  const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)
  const ownerExternalUserId = myBinding ? resolveOwnerExternalUserId(myBinding.credentials) : ''

  return NextResponse.json({
    messages: expandEventsToMessages(events),
    session: {
      activeAgentId: session.activeAgentId,
      agentId: effectiveAgentId,
      agentTitle: agent?.title ?? null,
      applicationId: sessionBinding.applicationId,
      bindingId: session.bindingId,
      canSend:
        isOwnBinding && canSendWechatDevOutbound(ownerExternalUserId, session.externalUserId),
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      id: session.id,
      isOwnBinding,
      lastActiveAt: session.lastActiveAt.toISOString(),
    },
  })
})

export const POST = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  if (!text) return jsonError('text is required')
  if (text.length > MAX_OUTBOUND_TEXT_LENGTH) {
    return jsonError(`text exceeds ${MAX_OUTBOUND_TEXT_LENGTH} characters`)
  }

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (!binding) return jsonError('WeChat not bound', 404)
  if (!binding.enabled || binding.needsRebind) return jsonError('WeChat binding inactive or needs rebind', 409)

  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(sessionId)
  if (!session || session.bindingId !== binding.id) return jsonError('Session not found', 404)

  const ownerExternalUserId = resolveOwnerExternalUserId(binding.credentials)
  if (!canSendWechatDevOutbound(ownerExternalUserId, session.externalUserId)) {
    return jsonError('仅可向扫码授权的微信账号代发', 403)
  }

  const encryptedContextToken = await eventModel.findLatestEncryptedContextToken(sessionId)
  if (!encryptedContextToken) {
    return jsonError('该联系人尚无可用会话 token，请先用微信发一条消息', 400)
  }

  try {
    await sendWechatOutboundText({
      credentials: binding.credentials,
      encryptedContextToken,
      text,
      toUserId: session.externalUserId,
    })
  } catch (error) {
    if (error instanceof WechatOutboundError) return jsonError(error.message, 400)
    const message = error instanceof Error ? error.message : 'Send failed'
    return jsonError(message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 200), 502)
  }

  const event = await eventModel.insertOutboundMessage({
    bindingId: binding.id,
    conversationVersion: session.conversationVersion,
    encryptedContextToken,
    externalUserId: session.externalUserId,
    responseText: text,
    sessionId: session.id,
  })

  const [message] = expandEventsToMessages([
    {
      completedAt: event.completedAt,
      content: event.content,
      createdAt: event.createdAt,
      id: event.id,
      lastErrorCode: event.lastErrorCode,
      lastErrorMessage: event.lastErrorMessage,
      messageKind: event.messageKind,
      responseText: event.responseText,
      status: event.status,
    },
  ])

  return NextResponse.json({ message })
})
