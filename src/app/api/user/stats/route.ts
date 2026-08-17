import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChatMessageModel } from '@pure/database/models/chatMessage'
import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { withAuth } from '@/libs/auth/get-session-user'

/**
 * GET /api/user/stats
 * 当前用户的 Agent / Topic / Message 数量统计
 */
export const GET = withAuth(async (_request, { userId }) => {
  try {
    const agentModel = new AgentModel(userId)
    const topicModel = new ChatTopicModel(userId)
    const messageModel = new ChatMessageModel(userId)

    const [agents, topics, messages] = await Promise.all([
      agentModel.countVisible(),
      topicModel.countAll(),
      messageModel.countAll(),
    ])

    return NextResponse.json({ agents, messages, topics })
  } catch (error) {
    console.error('[api/user/stats] GET failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
