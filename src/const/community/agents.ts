import { AssistantCategory, type DiscoverAgentItem } from '@/features/community/types'

import { COMMUNITY_AGENTS_DATA } from './agents.data'

/** Business categories (excludes `all`). */
export const ASSISTANT_BUSINESS_CATEGORIES = [
  AssistantCategory.Academic,
  AssistantCategory.Career,
  AssistantCategory.CopyWriting,
  AssistantCategory.Design,
  AssistantCategory.Education,
  AssistantCategory.Emotions,
  AssistantCategory.Entertainment,
  AssistantCategory.Games,
  AssistantCategory.General,
  AssistantCategory.Life,
  AssistantCategory.Marketing,
  AssistantCategory.Office,
  AssistantCategory.Programming,
  AssistantCategory.Translation,
] as const

export type AssistantBusinessCategory = (typeof ASSISTANT_BUSINESS_CATEGORIES)[number]

export const ASSISTANT_CATEGORY_LABELS: Record<AssistantCategory, string> = {
  [AssistantCategory.All]: '全部',
  [AssistantCategory.Academic]: '学术',
  [AssistantCategory.Career]: '职业',
  [AssistantCategory.CopyWriting]: '文案',
  [AssistantCategory.Design]: '设计',
  [AssistantCategory.Education]: '教育',
  [AssistantCategory.Emotions]: '情感',
  [AssistantCategory.Entertainment]: '娱乐',
  [AssistantCategory.Games]: '游戏',
  [AssistantCategory.General]: '通用',
  [AssistantCategory.Life]: '生活',
  [AssistantCategory.Marketing]: '创业',
  [AssistantCategory.Office]: '办公',
  [AssistantCategory.Programming]: '编程',
  [AssistantCategory.Translation]: '翻译',
}

/** 社区助手快照（`pnpm agents:sync` 更新） */
export const COMMUNITY_AGENTS: DiscoverAgentItem[] = COMMUNITY_AGENTS_DATA

export const getAssistantCategoryCounts = (
  agents: DiscoverAgentItem[] = COMMUNITY_AGENTS
): Record<AssistantCategory, number> => {
  const counts = Object.fromEntries(Object.values(AssistantCategory).map((key) => [key, 0])) as Record<
    AssistantCategory,
    number
  >

  for (const agent of agents) {
    counts[agent.category] += 1
  }

  counts[AssistantCategory.All] = agents.length
  return counts
}

export const filterCommunityAgents = (
  agents: DiscoverAgentItem[],
  options: { category?: string | null; q?: string | null }
): DiscoverAgentItem[] => {
  const category = options.category ?? AssistantCategory.All
  const query = options.q?.trim().toLowerCase() ?? ''

  return agents.filter((agent) => {
    const matchCategory = category === AssistantCategory.All || agent.category === category
    if (!matchCategory) return false

    if (!query) return true

    const haystack = [agent.title, agent.description, agent.author, agent.identifier].join(' ').toLowerCase()
    return haystack.includes(query)
  })
}
