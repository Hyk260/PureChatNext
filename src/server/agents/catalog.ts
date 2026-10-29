import { createHash } from 'node:crypto'

import { loadCommunityAgent } from '@/const/community/agentDetails'
import { COMMUNITY_AGENTS_DATA } from '@/const/community/agents.data'
import type { AgentProfile } from '@/const/home/agents'

const summaries = new Map(COMMUNITY_AGENTS_DATA.map((agent) => [agent.identifier, agent]))

export type AgentDefinition = { profile: AgentProfile; revision: string }

export function defineAgentProfile(profile: AgentProfile): AgentDefinition {
  const revision = createHash('sha256').update(JSON.stringify(profile)).digest('hex')
  return { profile, revision }
}

export async function findCommunityDefinition(identifier: string): Promise<AgentDefinition | null> {
  const summary = summaries.get(identifier)
  if (!summary) return null
  const agent = await loadCommunityAgent(summary)
  return defineAgentProfile({
    avatar: agent.avatar,
    backgroundColor: agent.backgroundColor ?? null,
    description: agent.description,
    openingMessage: agent.openingMessage ?? null,
    openingQuestions: agent.openingQuestions ?? [],
    systemRole: agent.systemRole,
    title: agent.title,
  })
}
