import { NextResponse } from 'next/server'

import { AgentModel } from '@/database/models/agent'
import { ChatMessageModel } from '@/database/models/chatMessage'
import { ChatTopicModel } from '@/database/models/chatTopic'
import { getAuthenticatedUserId, unauthorizedResponse } from '@/libs/auth/get-session-user'

export async function GET() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

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
}
