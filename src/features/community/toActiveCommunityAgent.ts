import type { AgentListItem } from '@/const/home/agents'
import type { ActiveCommunityAgent } from '@/features/community/types'

export function toActiveCommunityAgent(agent: Pick<
  AgentListItem,
  'avatar' | 'id' | 'openingMessage' | 'openingQuestions' | 'systemRole' | 'title'
>): ActiveCommunityAgent {
  return {
    avatar: agent.avatar,
    identifier: agent.id,
    openingMessage: agent.openingMessage,
    openingQuestions: agent.openingQuestions,
    systemRole: agent.systemRole,
    title: agent.title,
  }
}
