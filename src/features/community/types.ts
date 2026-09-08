export enum DiscoverTab {
  Agent = 'agent',
  Model = 'model',
  Provider = 'provider',
}

export enum AssistantCategory {
  Academic = 'academic',
  All = 'all',
  Career = 'career',
  CopyWriting = 'copywriting',
  Custom = 'custom',
  Design = 'design',
  Education = 'education',
  Emotions = 'emotions',
  Entertainment = 'entertainment',
  Games = 'games',
  General = 'general',
  Life = 'life',
  Marketing = 'marketing',
  Office = 'office',
  Programming = 'programming',
  Translation = 'translation',
}

export type AssistantMarketCategory = Exclude<AssistantCategory, AssistantCategory.All | AssistantCategory.Custom>

export interface DiscoverProviderItem {
  description: string
  id: string
  identifier: string
  modelCount: number
  models: string[]
  name: string
  url: string
}

export type DiscoverModelType = 'chat' | 'image'

export interface DiscoverModelAbilities {
  functionCall?: boolean
  vision?: boolean
}

export interface DiscoverModelItem {
  abilities?: DiscoverModelAbilities
  contextWindowTokens?: number
  description: string
  displayName: string
  id: string
  identifier: string
  providers: string[]
  releasedAt?: string
  type: DiscoverModelType
}

export interface DiscoverAgentExample {
  content: string
  role: 'assistant' | 'user'
}

export interface DiscoverAgentItem {
  author: string
  avatar: string
  backgroundColor?: string
  category: Exclude<AssistantCategory, AssistantCategory.All>
  createdAt: string
  description: string
  examples?: DiscoverAgentExample[]
  forkCount?: number
  identifier: string
  knowledgeCount?: number
  openingMessage?: string
  openingQuestions?: string[]
  pluginCount?: number
  summary?: string
  systemRole: string
  tags?: string[]
  title: string
  tokenUsage?: number
}

export interface ActiveCommunityAgent {
  avatar: string
  identifier: string
  openingMessage?: string | null
  openingQuestions?: string[] | null
  systemRole: string
  title: string
}
