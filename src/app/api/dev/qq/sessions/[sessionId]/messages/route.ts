import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import type { ChannelEventItem } from '@pure/database/schemas/channel'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { canSendQQDevOutbound, sendQQDevOutbound } from '@/libs/channels/qq/outbound'
import { expandQQEventsToMessages } from '@/libs/channels/qq/timeline'
import { resolveQQThreadType } from '@/libs/channels/qq/thread'
import {
  advanceWechatTimelineCursor,
  encodeWechatTimelineCursor,
  parseWechatTimelineCursor,
} from '@/libs/channels/wechat/timelineCursor'

const MAX_OUTBOUND_TEXT_LENGTH = 2000

function outboundMessage(event: ChannelEventItem) {
  const [message] = expandQQEventsToMessages([
    {
      ...event,
      attachments: [],
      completedAt: new Date(),
      status: 'completed',
    },
  ])
  return message ?? null
}

/**
 * GET /api/dev/qq/sessions/[sessionId]/messages
 * 开发环境：分页拉取 QQ 会话时间线消息
 */
export const GET = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, QQ_PLATFORM)
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam) ? limitParam : 50
  const cursorParam = request.nextUrl.searchParams.get('cursor')
  const after = cursorParam ? parseWechatTimelineCursor(cursorParam) : null
  if (cursorParam && !after) return jsonError('Invalid cursor', 400)
  const conversationVersionParam = request.nextUrl.searchParams.get('conversationVersion')
  const conversationVersion = conversationVersionParam === null ? undefined : Number(conversationVersionParam)
  if (conversationVersion !== undefined && (!Number.isInteger(conversationVersion) || conversationVersion < 1)) {
    return jsonError('Invalid conversationVersion', 400)
  }
  const watchEventIds = request.nextUrl.searchParams
    .getAll('watchEventId')
    .filter((id) => id.length > 0 && id.length <= 128)
    .slice(0, 20)

  const result = await new ChannelEventModel().listTimelineBySession(sessionId, {
    ...(after ? { after } : {}),
    conversationVersion,
    limit,
    watchEventIds,
  })
  if (!result) return jsonError('Session not found', 404)

  const sessionBinding = await new ChannelBindingModel().findById(result.session.bindingId)
  if (!sessionBinding || sessionBinding.platform !== QQ_PLATFORM) {
    return jsonError('Session not found', 404)
  }

  const { events, session } = result
  const effectiveAgentId = session.activeAgentId || sessionBinding.agentId
  const agent = await new AgentModel(userId).findVisibleById(effectiveAgentId)
  const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)

  const responseCursor = encodeWechatTimelineCursor(
    advanceWechatTimelineCursor(
      after,
      events.map(({ createdAt, id }) => ({ createdAt, id }))
    ) ?? { createdAt: new Date(0), id: '' }
  )
  const expandedMessages = expandQQEventsToMessages(events)

  return NextResponse.json({
    cursor: responseCursor,
    messages: cursorParam ? expandedMessages : expandedMessages.slice(-Math.min(Math.max(limit, 1), 200)),
    session: {
      activeAgentId: session.activeAgentId,
      agentId: effectiveAgentId,
      agentTitle: agent?.title ?? null,
      applicationId: sessionBinding.applicationId,
      bindingId: session.bindingId,
      canSend: isOwnBinding && Boolean(myBinding?.enabled && !myBinding.needsRebind),
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      externalUserName: session.externalUserName,
      id: session.id,
      isOwnBinding,
      lastActiveAt: session.lastActiveAt.toISOString(),
      threadType: session.threadType,
    },
  })
})

/**
 * POST /api/dev/qq/sessions/[sessionId]/messages
 * 开发环境：向 QQ 会话发送出站文本消息
 */
export const POST = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  let body: { requestId?: unknown; text?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!requestId || requestId.length > 128) return jsonError('Invalid requestId', 400)
  if (!text) return jsonError('请输入文字')
  if (text.length > MAX_OUTBOUND_TEXT_LENGTH) {
    return jsonError(`text exceeds ${MAX_OUTBOUND_TEXT_LENGTH} characters`)
  }

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, QQ_PLATFORM)
  if (!binding) return jsonError('QQ not bound', 404)
  if (!binding.enabled || binding.needsRebind) return jsonError('QQ binding inactive or needs rebind', 409)

  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(sessionId)
  if (!session || session.bindingId !== binding.id) return jsonError('Session not found', 404)
  if (!canSendQQDevOutbound(binding, session)) return jsonError('仅可向本人绑定的 QQ 会话代发', 403)

  const platformMessageId = `web-outbound:${requestId}`
  let event = await eventModel.findByPlatformMessageId(binding.id, platformMessageId)
  if (event && event.sessionId !== session.id) return jsonError('Invalid requestId', 400)
  if (event?.status === 'completed') {
    const message = outboundMessage(event)
    if (!message) return jsonError('已发送消息记录为空', 500)
    return NextResponse.json({ message })
  }

  if (!event) {
    event = await eventModel.insertQQOutbound({
      bindingId: binding.id,
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      platformMessageId,
      platformPayload: {
        threadId: session.externalUserId,
        threadType: session.threadType ?? resolveQQThreadType(session.externalUserId),
      },
      responseText: text,
      sessionId: session.id,
    })
  }

  try {
    await sendQQDevOutbound({ binding, session, text })
    await eventModel.completeOutbound(event.id)
  } catch (error) {
    await eventModel.failOutbound(event.id, error instanceof Error ? error.message : 'Send failed')
    const message = error instanceof Error ? error.message : 'Send failed'
    return jsonError(message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 200), 502)
  }

  const message = outboundMessage({ ...event, responseText: text })
  if (!message) return jsonError('发送成功但未返回消息记录', 500)
  return NextResponse.json({ message })
})
