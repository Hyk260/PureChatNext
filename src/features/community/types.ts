export enum DiscoverTab {
  Agent = 'agent',
  Model = 'model',
  Provider = 'provider',
  Skill = 'skill',
}

export enum SkillCategory {
  AgentToAgentProtocols = 'agent-to-agent-protocols',
  AILLMs = 'ai-llms',
  All = 'all',
  AppleAppsServices = 'apple-apps-services',
  BrowserAutomation = 'browser-automation',
  CalendarScheduling = 'calendar-scheduling',
  ClawdbotTools = 'clawdbot-tools',
  CLIUtilities = 'cli-utilities',
  CodingAgentsIDEs = 'coding-agents-ides',
  Communication = 'communication',
  DataAnalytics = 'data-analytics',
  DevOpsCloud = 'devops-cloud',
  Finance = 'finance',
  Gaming = 'gaming',
  GitGitHub = 'git-github',
  HealthFitness = 'health-fitness',
  ImageVideoGeneration = 'image-video-generation',
  IOSMacOSDevelopment = 'ios-macos-development',
  MarketingSales = 'marketing-sales',
  MediaStreaming = 'media-streaming',
  Moltbook = 'moltbook',
  NotesPKM = 'notes-pkm',
  PDFDocuments = 'pdf-documents',
  PersonalDevelopment = 'personal-development',
  ProductivityTasks = 'productivity-tasks',
  SearchResearch = 'search-research',
  SecurityPasswords = 'security-passwords',
  SelfHostedAutomation = 'self-hosted-automation',
  ShoppingEcommerce = 'shopping-ecommerce',
  SmartHomeIoT = 'smart-home-iot',
  SpeechTranscription = 'speech-transcription',
  Transportation = 'transportation',
  WebFrontendDevelopment = 'web-frontend-development',
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

export interface DiscoverSkillItem {
  author: string
  category: Exclude<SkillCategory, SkillCategory.All>
  description: string
  github?: { stars?: number; url?: string }
  homepage?: string
  icon?: string
  identifier: string
  isFeatured?: boolean
  license?: string
  name: string
  resourcesCount?: number
  tags?: string[]
  updatedAt: string
  version?: string
}

export type SkillMarketCategory = Exclude<SkillCategory, SkillCategory.All>
