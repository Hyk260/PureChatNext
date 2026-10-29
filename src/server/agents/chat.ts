import { ChatTopicModel } from '@pure/database/models/chatTopic'

import { AgentConfigurationError, AgentService } from './service'

type ChatAgentInput = { agentId?: string; system?: string; topicId?: string }

/** Old clients send only topicId and a cached system prompt; resolve their agent too. */
export async function resolveChatAgent(userId: string | null, input: ChatAgentInput): Promise<string | undefined> {
  if (input.agentId === undefined && input.topicId === undefined) return input.system
  if (!userId) throw new AgentConfigurationError('请先登录', 401)
  if (input.agentId !== undefined && (typeof input.agentId !== 'string' || !input.agentId.trim())) {
    throw new AgentConfigurationError('助理标识无效', 400)
  }
  if (input.topicId !== undefined && (typeof input.topicId !== 'string' || !input.topicId.trim())) {
    throw new AgentConfigurationError('话题标识无效', 400)
  }
  const topic = input.topicId ? await new ChatTopicModel(userId).findById(input.topicId) : undefined
  if (input.topicId && !topic) throw new AgentConfigurationError('话题不存在或无权访问', 404)
  if (topic && input.agentId && topic.agentId !== input.agentId) {
    throw new AgentConfigurationError('助理与话题不匹配', 400)
  }
  const agentId = input.agentId ?? topic?.agentId
  const agent = agentId ? await new AgentService(userId).findVisibleById(agentId) : undefined
  if (!agent) throw new AgentConfigurationError('助理不存在或无权访问', 404)
  return agent.systemRole ?? undefined
}
