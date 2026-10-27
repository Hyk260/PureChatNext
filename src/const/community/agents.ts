import { getCategoryCounts, filterCatalogItems } from '@/features/community/catalog'
import { AssistantCategory } from '@/features/community/types'
import type { DiscoverAgentSummary } from '@/features/community/types'

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
  [AssistantCategory.Custom]: '自定义',
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

/** 手选的社区助手目录。草稿来自 `pnpm agents:sync`，脚本不会覆盖。 */
export const COMMUNITY_AGENTS: DiscoverAgentSummary[] = COMMUNITY_AGENTS_DATA

export const getAssistantCategoryCounts = (
  agents: DiscoverAgentSummary[] = COMMUNITY_AGENTS
): Record<AssistantCategory, number> => getCategoryCounts(agents, Object.values(AssistantCategory), AssistantCategory.All)

export const filterCommunityAgents = (
  agents: DiscoverAgentSummary[],
  options: { category?: string | null; q?: string | null }
): DiscoverAgentSummary[] => {
  if (options.category === AssistantCategory.Custom) return []
  return filterCatalogItems(agents, options, (item) => [item.title, item.description, item.author, item.identifier])
}
