import { NextResponse } from 'next/server'

import { AgentService } from '@/server/agents/service'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const CHANNEL_PLATFORMS = new Set(['qq', 'wechat'])
const QQ_THREAD_PREFIX = new Map([
  ['group', 'qq:group:'],
  ['guild', 'qq:guild:'],
])

function maskChannelId(value: string) {
  if (value.length < 9) return '已隐藏'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function maskQQThreadId(value: string, threadType: string | null) {
  const prefix = QQ_THREAD_PREFIX.get(threadType ?? '') ?? 'qq:c2c:'
  const id = value.replace(/^qq:(?:group|guild|c2c):/, '')
  return `${prefix}${maskChannelId(id)}`
}

/** GET /api/channels/{platform}/sessions — list the signed-in user's own sessions. */
export const GET = withAuth<{ platform: string }>(async (_request, { params, userId }) => {
  const { platform } = await params
  if (!CHANNEL_PLATFORMS.has(platform)) return jsonError('Unknown channel', 404)

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, platform)
  if (!binding) {
    return NextResponse.json(
      { bound: false, sessions: [] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

  const sessions = await new ChannelEventModel().listSessionsByBinding(binding.id, 100)
  const agentIds = new Set<string>([binding.agentId])
  for (const session of sessions) {
    if (session.activeAgentId) agentIds.add(session.activeAgentId)
  }
  const agentModel = new AgentService(userId)
  const agentTitles = new Map<string, string>()
  await Promise.all(
    [...agentIds].map(async (id) => {
      const agent = await agentModel.findVisibleById(id)
      if (agent?.title) agentTitles.set(id, agent.title)
    })
  )

  const response = NextResponse.json({
    agentId: binding.agentId,
    agentTitle: agentTitles.get(binding.agentId) ?? null,
    bound: true,
    sessions: sessions.map((session) => {
      const agentId = session.activeAgentId || binding.agentId
      return {
        activeAgentId: session.activeAgentId,
        agentId,
        agentTitle: agentTitles.get(agentId) ?? null,
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
      }
    }),
  })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
})
