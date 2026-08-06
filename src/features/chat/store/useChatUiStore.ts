'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_CHAT_LLM_PARAMS } from '@/features/chat/types'
import type { ChatLlmParams, ChatSearchMode, TopicGroupMode, TopicPageSize, TopicSortBy } from '@/features/chat/types'

type ChatUiState = {
  leftCollapsed: boolean
  rightCollapsed: boolean
  /** true = 聊天区占满主栏宽度；false = 居中限宽 */
  wideScreen: boolean
  /** agentId → params */
  paramsByAgent: Record<string, ChatLlmParams>
  /** agentId → web search mode */
  searchModeByAgent: Record<string, ChatSearchMode>
  /** Shared across all agents */
  topicGroupMode: TopicGroupMode
  topicPageSize: TopicPageSize
  topicSortBy: TopicSortBy
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  toggleWideScreen: (value?: boolean) => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
  getParams: (agentId: string) => ChatLlmParams
  setParams: (agentId: string, patch: Partial<ChatLlmParams>) => void
  setSearchMode: (agentId: string, mode: ChatSearchMode) => void
  setTopicGroupMode: (mode: TopicGroupMode) => void
  setTopicPageSize: (pageSize: TopicPageSize) => void
  setTopicSortBy: (sortBy: TopicSortBy) => void
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set, get) => ({
      leftCollapsed: false,
      rightCollapsed: true,
      wideScreen: false,
      paramsByAgent: {},
      searchModeByAgent: {},
      topicGroupMode: 'byTime',
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
      setSearchMode: (agentId, mode) =>
        set((s) => ({
          searchModeByAgent: {
            ...s.searchModeByAgent,
            [agentId]: mode,
          },
        })),
      setTopicGroupMode: (topicGroupMode) => set({ topicGroupMode }),
      setTopicPageSize: (topicPageSize) => set({ topicPageSize }),
      setTopicSortBy: (topicSortBy) => set({ topicSortBy }),
    }),
    {
      name: 'purechat:chat:v2:ui',
      version: 5,
      migrate: (persisted, version) => {
        let state = (persisted ?? {}) as Record<string, unknown>
        if (version < 4) {
          const byAgent = state.topicGroupModeByAgent as Record<string, TopicGroupMode> | undefined
          const firstMode = byAgent ? Object.values(byAgent)[0] : undefined
          const { topicGroupModeByAgent: _, ...rest } = state
          state = {
            ...rest,
            topicGroupMode: firstMode ?? 'byTime',
          }
        }
        return version < 5 ? { ...state, searchModeByAgent: {} } : state
      },
    }
  )
)
