import { NextResponse } from 'next/server'

import { AgentService } from '@/server/agents/service'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { withAdmin } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { canSendWechatDevOutbound } from '@/libs/channels/wechat/outbound'
import { isWechatGatewaySupported } from '@/libs/channels/wechat'
import { isChannelHeartbeatStale, resolveWechatRuntimeStatus } from '@/libs/channels/wechat/runtimeStatus'

/**
 * GET /api/admin/wechat/sessions
 * 管理员：列出微信渠道会话
 */
export const GET = withAdmin(async (_request, { userId }) => {
  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)

  let ownerExternalUserId = ''
  if (myBinding) {
    try {
      ownerExternalUserId = decryptCredentials(myBinding.credentials).userId?.trim() || ''
    } catch {
      ownerExternalUserId = ''
    }
  }

  // 展示本库全部 wechat 会话，便于切换查看；代发仍仅限本人 binding + 扫码授权者
  const eventModel = new ChannelEventModel()
  const sessions = await eventModel.listSessionsByPlatform(WECHAT_PLATFORM)
  const bindingIds = [...new Set(sessions.map(({ bindingId }) => bindingId))]
  const failedEventCounts = await eventModel.countFailedByBindings(bindingIds)
  const gatewaySupported = isWechatGatewaySupported()
  const agentModel = new AgentService(userId)
  const agentIds = new Set<string>()
  if (myBinding?.agentId) agentIds.add(myBinding.agentId)
  for (const session of sessions) {
    if (session.activeAgentId) agentIds.add(session.activeAgentId)
    if (session.bindingAgentId) agentIds.add(session.bindingAgentId)
  }

  const agentTitles = new Map<string, string>()
  await Promise.all(
    [...agentIds].map(async (id) => {
      const agent = await agentModel.findVisibleById(id)
      if (agent?.title) agentTitles.set(id, agent.title)
    })
  )

  return NextResponse.json({
    agentId: myBinding?.agentId,
    agentTitle: myBinding ? (agentTitles.get(myBinding.agentId) ?? null) : null,
    bound: Boolean(myBinding),
    ownerExternalUserId: ownerExternalUserId || null,
    sessions: sessions.map((session) => {
      const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)
      const effectiveAgentId = session.activeAgentId || session.bindingAgentId
      const failedEventCount = failedEventCounts.get(session.bindingId) ?? 0
      const heartbeatStale = isChannelHeartbeatStale(session.bindingLastHeartbeatAt)
      const waitingForFirstHeartbeat =
        session.bindingRuntimeStatus === 'starting' &&
        !session.bindingLastHeartbeatAt &&
        Date.now() - session.bindingUpdatedAt.getTime() <= 90_000
      const runtimeStatus = resolveWechatRuntimeStatus({
        enabled: session.bindingEnabled,
        failedEventCount,
        gatewaySupported,
        heartbeatStale,
        needsRebind: session.bindingNeedsRebind,
        runtimeStatus: session.bindingRuntimeStatus,
        waitingForFirstHeartbeat,
      })
      return {
        activeAgentId: session.activeAgentId,
        agentId: effectiveAgentId,
        agentTitle: agentTitles.get(effectiveAgentId) ?? null,
        applicationId: session.applicationId,
        bindingId: session.bindingId,
        canSend:
          isOwnBinding &&
          session.bindingEnabled &&
          !session.bindingNeedsRebind &&
          canSendWechatDevOutbound(ownerExternalUserId, session.externalUserId),
        conversationVersion: session.conversationVersion,
        connected: runtimeStatus === 'online' || runtimeStatus === 'degraded',
        externalUserId: session.externalUserId,
        externalUserName: session.externalUserName,
        failedEventCount,
        id: session.id,
        isOwnBinding,
        lastActiveAt: session.lastActiveAt.toISOString(),
        lastError: session.bindingLastErrorCode
          ? {
              code: session.bindingLastErrorCode,
              message: session.bindingLastErrorMessage || '微信渠道暂时异常',
            }
          : null,
        lastHeartbeatAt: session.bindingLastHeartbeatAt?.toISOString() ?? null,
        runtimeStatus,
      }
    }),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
})
