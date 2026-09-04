import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { withAuth } from '@/libs/auth/get-session-user'

/**
 * GET /api/dev/qq/sessions
 * 开发环境：列出 QQ 会话（仅开发调试）
 */
export const GET = withAuth(async (_request, { userId }) => {
  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, QQ_PLATFORM)
  const sessions = await new ChannelEventModel().listSessionsByPlatform(QQ_PLATFORM)

  const agentModel = new AgentModel(userId)
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
      return {
        activeAgentId: session.activeAgentId,
        agentId: effectiveAgentId,
        agentTitle: agentTitles.get(effectiveAgentId) ?? null,
        applicationId: session.applicationId,
        bindingId: session.bindingId,
        canSend: isOwnBinding && Boolean(myBinding?.enabled && !myBinding.needsRebind),
        conversationVersion: session.conversationVersion,
        externalUserId: session.externalUserId,
        externalUserName: session.externalUserName,
        id: session.id,
        isOwnBinding,
        lastActiveAt: session.lastActiveAt.toISOString(),
        threadType: session.threadType,
      }
    }),
  })
})
