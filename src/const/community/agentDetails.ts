import type { DiscoverAgentDetails, DiscoverAgentItem, DiscoverAgentSummary } from '@/features/community/types'

// Each category is a separate lazy chunk; browsing the catalog needs only summaries.
type AgentDetailLoaders = Record<string, () => Promise<Record<string, DiscoverAgentDetails>>>
// Explicit imports work in both the Vite SPA and the Next server bundle.
const detailLoaders: AgentDetailLoaders = Object.fromEntries(
  Object.entries({
    academic: () => import('./agent-details/academic.json'),
    career: () => import('./agent-details/career.json'),
    copywriting: () => import('./agent-details/copywriting.json'),
    design: () => import('./agent-details/design.json'),
    education: () => import('./agent-details/education.json'),
    emotions: () => import('./agent-details/emotions.json'),
    entertainment: () => import('./agent-details/entertainment.json'),
    games: () => import('./agent-details/games.json'),
    general: () => import('./agent-details/general.json'),
    life: () => import('./agent-details/life.json'),
    marketing: () => import('./agent-details/marketing.json'),
    office: () => import('./agent-details/office.json'),
    programming: () => import('./agent-details/programming.json'),
    translation: () => import('./agent-details/translation.json'),
  }).map(([category, load]) => [category, async () => (await load()).default])
) as AgentDetailLoaders

export async function loadCommunityAgent(agent: DiscoverAgentSummary | DiscoverAgentItem): Promise<DiscoverAgentItem> {
  if ('systemRole' in agent) return agent

  const load = detailLoaders[agent.category]
  if (!load) throw new Error(`Unknown community agent category: ${agent.category}`)
  const details = (await load())[agent.identifier]
  if (!details) throw new Error(`Unknown community agent: ${agent.identifier}`)
  return { ...agent, ...details }
}
