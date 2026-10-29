import { NextResponse } from 'next/server'

import { AgentService } from '@/server/agents/service'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { gatewayEnv } from '@/envs/gateway'
import { withAdmin } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/qq'
import { isChannelHeartbeatFresh, resolveQqConnected, resolveQqRuntimeStatus } from '@/libs/channels/qq/runtimeStatus'

/**
 * GET /api/admin/qq/sessions
 * 管理员：列出 QQ 渠道会话
 */
export const GET = withAdmin(async (_request, { userId }) => {
  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, QQ_PLATFORM)
  const sessions = await new ChannelEventModel().listSessionsByPlatform(QQ_PLATFORM)
  const bindingIds = [...new Set(sessions.map(({ bindingId }) => bindingId))]
  const bindingCredentials = await new ChannelBindingModel().findCredentialsByIds(bindingIds)
  const connectionModes = new Map<string, 'websocket' | 'webhook'>()
  for (const binding of bindingCredentials) {
    try {
      connectionModes.set(binding.id, decryptCredentials(binding.credentials).connectionMode)
    } catch {
      connectionModes.set(binding.id, 'websocket')
    }
  }

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
    sessions: sessions.map((session) => {
      const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)
      const effectiveAgentId = session.activeAgentId || session.bindingAgentId
      const connectionMode = connectionModes.get(session.bindingId) ?? 'websocket'
      const runtimeStatus = resolveQqRuntimeStatus({
        connectionMode,
        enabled: session.bindingEnabled,
        gatewaySupported: gatewayEnv.CHANNEL_GATEWAY_ENABLED,
        heartbeatFresh: isChannelHeartbeatFresh(session.bindingLastHeartbeatAt),
        needsRebind: session.bindingNeedsRebind,
        runtimeStatus: session.bindingRuntimeStatus,
      })
      return {
        activeAgentId: session.activeAgentId,
        agentId: effectiveAgentId,
        agentTitle: agentTitles.get(effectiveAgentId) ?? null,
        applicationId: session.applicationId,
        bindingId: session.bindingId,
        canSend: isOwnBinding && session.bindingEnabled && !session.bindingNeedsRebind,
        conversationVersion: session.conversationVersion,
        connected: resolveQqConnected(runtimeStatus),
        connectionMode,
        externalUserId: session.externalUserId,
        externalUserName: session.externalUserName,
        id: session.id,
        isOwnBinding,
        lastActiveAt: session.lastActiveAt.toISOString(),
        lastError: session.bindingLastErrorCode
          ? {
              code: session.bindingLastErrorCode,
              message: session.bindingLastErrorMessage || 'QQ Gateway 暂时异常',
            }
          : null,
        lastHeartbeatAt: session.bindingLastHeartbeatAt?.toISOString() ?? null,
        runtimeStatus,
        threadType: session.threadType,
      }
    }),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
})
