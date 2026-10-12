import type { DiscoverAgentDetails, DiscoverAgentItem, DiscoverAgentSummary } from '@/features/community/types'

// Each category is a separate lazy chunk; browsing the catalog needs only summaries.
type AgentDetailLoaders = Record<string, () => Promise<Record<string, DiscoverAgentDetails>>>
const detailLoaders = import.meta.glob('./agent-details/*.json', {
  import: 'default',
}) as AgentDetailLoaders

export async function loadCommunityAgent(agent: DiscoverAgentSummary | DiscoverAgentItem): Promise<DiscoverAgentItem> {
  if ('systemRole' in agent) return agent

  const load = detailLoaders[`./agent-details/${agent.category}.json`]
  if (!load) throw new Error(`Unknown community agent category: ${agent.category}`)
  const details = (await load())[agent.identifier]
  if (!details) throw new Error(`Unknown community agent: ${agent.identifier}`)
  return { ...agent, ...details }
}
