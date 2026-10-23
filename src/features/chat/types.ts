import type { ChatPermissionMode } from '@pure/types'

export type LocalChatTopic = {
  id: string
  agentId: string
  createdAt: number
  favorite: boolean
  permissionMode: ChatPermissionMode
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
  permissionMode?: ChatPermissionMode
  projectName?: string | null
  title?: string
}
