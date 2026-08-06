export type LocalChatTopic = {
  id: string
  agentId: string
  createdAt: number
  favorite: boolean
  projectName: string | null
  title: string
  updatedAt: number
}

export type TopicGroupMode = 'byTime' | 'byProject' | 'flat'

export type TopicSortBy = 'createdAt' | 'updatedAt'

export type TopicDeleteScope = 'all' | 'unfavorited'

export type TopicPageSize = 20 | 40 | 60 | 100

export type ChatSearchMode = 'auto' | 'off'

export type TopicUpdate = {
  favorite?: boolean
  projectName?: string | null
  title?: string
}

export type ChatLlmParams = {
  temperature: number | null
  top_p: number | null
  presence_penalty: number | null
  frequency_penalty: number | null
}

export const DEFAULT_CHAT_LLM_PARAMS: ChatLlmParams = {
  temperature: 1,
  top_p: 1,
  presence_penalty: 0,
  frequency_penalty: 0,
}
