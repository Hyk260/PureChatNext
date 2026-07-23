import { DEFAULT_SIDEBAR_ITEMS, normalizeSidebarItems } from '@/const/home/nav'

export interface HomeAgentGroup {
  id: string
  name: string
  sort: number
}

export const DEFAULT_AGENT_GROUPS: HomeAgentGroup[] = [{ id: 'default', name: '默认', sort: 0 }]

export const DEFAULT_SIDEBAR_EXPANDED_KEYS = ['recents', 'agents']

export const DEFAULT_HIDDEN_SIDEBAR_SECTIONS: string[] = []

export const DEFAULT_HOME_SIDEBAR_STATE = {
  agentGroups: DEFAULT_AGENT_GROUPS,
  hiddenSidebarSections: DEFAULT_HIDDEN_SIDEBAR_SECTIONS,
  sidebarExpandedKeys: DEFAULT_SIDEBAR_EXPANDED_KEYS,
  sidebarItems: DEFAULT_SIDEBAR_ITEMS,
}

export const normalizePersistedSidebarItems = (items: string[] | undefined): string[] =>
  normalizeSidebarItems(items?.length ? items : DEFAULT_SIDEBAR_ITEMS)

export const normalizeSidebarExpandedKeys = (keys: string[]): string[] =>
  keys.map((key) => (key === 'agent' ? 'agents' : key))

export const mergeSidebarExpandedKeys = (
  currentKeys: string[],
  accordionKeys: string[],
  expandedKeys: string[]
): string[] => {
  const nextExpandedKeys = new Set(expandedKeys.map(String))
  const accordionKeySet = new Set(accordionKeys)
  const nextKeys = currentKeys.filter((key) => !accordionKeySet.has(key))

  for (const key of accordionKeys) {
    if (nextExpandedKeys.has(key)) nextKeys.push(key)
  }

  return nextKeys
}

export const pickAccordionExpandedKeys = (sidebarExpandedKeys: string[], accordionKeys: string[]): string[] =>
  accordionKeys.filter((key) => sidebarExpandedKeys.includes(key))
