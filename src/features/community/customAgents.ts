import type { AgentListItem } from '@/const/home/agents'
import { AssistantCategory } from '@/features/community/types'
import type { DiscoverAgentItem } from '@/features/community/types'

export function isCustomUserAgent(agent: AgentListItem): boolean {
  return !agent.isBuiltin && !agent.marketIdentifier
}

export function toDiscoverAgentFromListItem(agent: AgentListItem): DiscoverAgentItem {
  const openingMessage = agent.openingMessage?.trim()
  const openingQuestions = agent.openingQuestions?.filter((question) => question.trim().length > 0)

  const item: DiscoverAgentItem = {
    author: '我',
    avatar: agent.avatar,
    backgroundColor: agent.backgroundColor ?? undefined,
    category: AssistantCategory.Custom,
    createdAt: '',
    description: agent.description?.trim() || '',
    identifier: agent.id,
    systemRole: agent.systemRole,
    title: agent.title,
  }

  if (openingMessage) item.openingMessage = openingMessage
  if (openingQuestions && openingQuestions.length > 0) item.openingQuestions = openingQuestions

  return item
}

export function countCustomAgents(agents: readonly AgentListItem[]): number {
  return agents.filter(isCustomUserAgent).length
}

export function filterCustomAgents(agents: readonly AgentListItem[], query?: string | null): AgentListItem[] {
  const customAgents = agents.filter(isCustomUserAgent)
  const normalizedQuery = query?.trim().toLowerCase() ?? ''
  if (!normalizedQuery) return customAgents

  return customAgents.filter((agent) => {
    const haystack = [agent.title, agent.description, agent.slug].join(' ').toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
