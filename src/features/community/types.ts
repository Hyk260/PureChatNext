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

export interface DiscoverModelItem {
  description: string
  displayName: string
  id: string
  identifier: string
  providers: string[]
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
