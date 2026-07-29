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

export interface DiscoverAgentItem {
  author: string
  avatar: string
  backgroundColor?: string
  category: Exclude<AssistantCategory, AssistantCategory.All>
  createdAt: string
  description: string
  forkCount?: number
  identifier: string
  knowledgeCount?: number
  pluginCount?: number
  systemRole: string
  title: string
  tokenUsage?: number
}

export interface ActiveCommunityAgent {
  avatar: string
  identifier: string
  systemRole: string
  title: string
}
