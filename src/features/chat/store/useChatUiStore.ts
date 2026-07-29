'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  DEFAULT_CHAT_LLM_PARAMS,
  type ChatLlmParams,
  type TopicGroupMode,
  type TopicPageSize,
  type TopicSortBy,
} from '@/features/chat/types'

type ChatUiState = {
  leftCollapsed: boolean
  rightCollapsed: boolean
  /** true = 聊天区占满主栏宽度；false = 居中限宽 */
  wideScreen: boolean
  /** agentId → params */
  paramsByAgent: Record<string, ChatLlmParams>
  /** agentId → topic grouping preference */
  topicGroupModeByAgent: Record<string, TopicGroupMode>
  topicPageSize: TopicPageSize
  topicSortBy: TopicSortBy
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  toggleWideScreen: (value?: boolean) => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
  getParams: (agentId: string) => ChatLlmParams
  setParams: (agentId: string, patch: Partial<ChatLlmParams>) => void
  setTopicGroupMode: (agentId: string, mode: TopicGroupMode) => void
  setTopicPageSize: (pageSize: TopicPageSize) => void
  setTopicSortBy: (sortBy: TopicSortBy) => void
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set, get) => ({
      leftCollapsed: false,
      rightCollapsed: false,
      wideScreen: false,
      paramsByAgent: {},
      topicGroupModeByAgent: {},
      topicPageSize: 40,
      topicSortBy: 'updatedAt',
      toggleLeftCollapsed: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
      toggleRightCollapsed: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
      toggleWideScreen: (value) =>
        set((s) => ({
          wideScreen: typeof value === 'boolean' ? value : !s.wideScreen,
        })),
      setLeftCollapsed: (leftCollapsed) => set({ leftCollapsed }),
      setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
      getParams: (agentId) => get().paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS,
      setParams: (agentId, patch) =>
        set((s) => ({
          paramsByAgent: {
            ...s.paramsByAgent,
            [agentId]: {
              ...(s.paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS),
              ...patch,
            },
          },
        })),
      setTopicGroupMode: (agentId, mode) =>
        set((s) => ({
          topicGroupModeByAgent: { ...s.topicGroupModeByAgent, [agentId]: mode },
        })),
      setTopicPageSize: (topicPageSize) => set({ topicPageSize }),
      setTopicSortBy: (topicSortBy) => set({ topicSortBy }),
    }),
    { name: 'purechat:chat:v2:ui', version: 3 }
  )
)
