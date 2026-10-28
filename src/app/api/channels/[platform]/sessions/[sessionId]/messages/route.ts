import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { expandQQEventsToMessages } from '@/libs/channels/qq/timeline'
import { expandEventsToMessages } from '@/libs/channels/wechat/timeline'
import {
  advanceWechatTimelineCursor,
  encodeWechatTimelineCursor,
  parseWechatTimelineCursor,
} from '@/libs/channels/wechat/timelineCursor'

const CHANNEL_PLATFORMS = new Set(['qq', 'wechat'])

function maskChannelId(value: string) {
  if (value.length < 9) return '已隐藏'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function maskQQThreadId(value: string, threadType: string | null) {
  const prefix = threadType === 'group' ? 'qq:group:' : threadType === 'guild' ? 'qq:guild:' : 'qq:c2c:'
  const id = value.replace(/^qq:(?:group|guild|c2c):/, '')
  return `${prefix}${maskChannelId(id)}`
}

/** GET /api/channels/{platform}/sessions/{sessionId}/messages — read an owned session. */
export const GET = withAuth<{ platform: string; sessionId: string }>(async (request, { params, userId }) => {
  const { platform, sessionId } = await params
  if (!CHANNEL_PLATFORMS.has(platform)) return jsonError('Unknown channel', 404)
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, platform)
  if (!binding) return jsonError('Session not found', 404)

  const limitValue = Number(request.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitValue) ? limitValue : 50
  const cursorParam = request.nextUrl.searchParams.get('cursor')
  const after = cursorParam ? parseWechatTimelineCursor(cursorParam) : null
  if (cursorParam && !after) return jsonError('Invalid cursor', 400)

  const versionParam = request.nextUrl.searchParams.get('conversationVersion')
  const conversationVersion = versionParam === null ? undefined : Number(versionParam)
  if (conversationVersion !== undefined && (!Number.isInteger(conversationVersion) || conversationVersion < 1)) {
    return jsonError('Invalid conversationVersion', 400)
  }

  const watchEventIds = request.nextUrl.searchParams
    .getAll('watchEventId')
    .filter((id) => id.length > 0 && id.length <= 128)
    .slice(0, 20)

  const result = await new ChannelEventModel().listTimelineBySession(sessionId, {
    ...(after ? { after } : {}),
    bindingId: binding.id,
    conversationVersion,
    limit,
    watchEventIds,
  })
  if (!result) return jsonError('Session not found', 404)

  const { events, session } = result
  const agentId = session.activeAgentId || binding.agentId
  const agent = await new AgentModel(userId).findVisibleById(agentId)
  const responseCursor = encodeWechatTimelineCursor(
    advanceWechatTimelineCursor(
      after,
      events.map(({ createdAt, id }) => ({ createdAt, id }))
    ) ?? { createdAt: new Date(0), id: '' }
  )
  const messages =
    platform === 'wechat'
      ? expandEventsToMessages(events, {
          mediaRouteBase: `/api/channels/wechat/sessions/${encodeURIComponent(sessionId)}/events`,
        })
      : expandQQEventsToMessages(events, {
          includeRemoteUrls: false,
          sessionUserName: session.externalUserName,
        }).map((message) => ({
          ...message,
          authorId: message.authorId ? maskChannelId(message.authorId) : undefined,
        }))

  const response = NextResponse.json({
    cursor: responseCursor,
    messages: cursorParam ? messages : messages.slice(-Math.min(Math.max(limit, 1), 200)),
    session: {
      activeAgentId: session.activeAgentId,
      agentId,
      agentTitle: agent?.title ?? null,
      canSend: false,
      conversationVersion: session.conversationVersion,
      externalUserId:
        platform === 'qq'
          ? maskQQThreadId(session.externalUserId, session.threadType)
          : maskChannelId(session.externalUserId),
      externalUserName: session.externalUserName,
      id: session.id,
      isOwnBinding: true,
      lastActiveAt: session.lastActiveAt.toISOString(),
      threadType: session.threadType,
    },
  })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
})
