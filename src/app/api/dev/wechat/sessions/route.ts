import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { canSendWechatDevOutbound } from '@/libs/channels/wechat/outbound'

export const GET = withAuth(async (_request, { userId }) => {
  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)

  let ownerExternalUserId = ''
  if (myBinding) {
    try {
      ownerExternalUserId = decryptCredentials(myBinding.credentials).userId?.trim() || ''
    } catch {
      ownerExternalUserId = ''
    }
  }

  // Dev 页：展示本库全部 wechat 会话，便于切换查看；代发仍仅限本人 binding + 扫码授权者
  const sessions = await new ChannelEventModel().listSessionsByPlatform(WECHAT_PLATFORM)
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
    ownerExternalUserId: ownerExternalUserId || null,
    sessions: sessions.map((session) => {
      const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)
      const effectiveAgentId = session.activeAgentId || session.bindingAgentId
      return {
        activeAgentId: session.activeAgentId,
        agentId: effectiveAgentId,
        agentTitle: agentTitles.get(effectiveAgentId) ?? null,
        applicationId: session.applicationId,
        bindingId: session.bindingId,
        canSend:
          isOwnBinding && canSendWechatDevOutbound(ownerExternalUserId, session.externalUserId),
        conversationVersion: session.conversationVersion,
        externalUserId: session.externalUserId,
        id: session.id,
        isOwnBinding,
        lastActiveAt: session.lastActiveAt.toISOString(),
      }
    }),
  })
})
