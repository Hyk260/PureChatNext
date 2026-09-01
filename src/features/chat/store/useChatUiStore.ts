'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  DEFAULT_WORK_PANEL_ACTIVE_TAB,
  DEFAULT_WORK_PANEL_OPEN_TABS,
  WORK_PANEL_TAB_BY_ID,
  isWorkPanelTabId,
  type WorkPanelTabId,
} from '@/features/chat/WorkPanel/tabs'
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
  workPanelOpenTabs: WorkPanelTabId[]
  workPanelActiveTab: WorkPanelTabId
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  toggleWideScreen: (value?: boolean) => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
  openWorkPanelTab: (tab: WorkPanelTabId) => void
  closeWorkPanelTab: (tab: WorkPanelTabId) => void
  setWorkPanelActiveTab: (tab: WorkPanelTabId) => void
  openParamsPanel: () => void
  getParams: (agentId: string) => ChatLlmParams
  setParams: (agentId: string, patch: Partial<ChatLlmParams>) => void
  setSearchMode: (agentId: string, mode: ChatSearchMode) => void
  setTopicGroupMode: (mode: TopicGroupMode) => void
  setTopicPageSize: (pageSize: TopicPageSize) => void
  setTopicSortBy: (sortBy: TopicSortBy) => void
}

function normalizeOpenTabs(tabs: unknown): WorkPanelTabId[] {
  if (!Array.isArray(tabs)) return [...DEFAULT_WORK_PANEL_OPEN_TABS]
  const next = tabs.filter((tab): tab is WorkPanelTabId => isWorkPanelTabId(tab) && WORK_PANEL_TAB_BY_ID[tab].implemented)
  return next.length > 0 ? next : [...DEFAULT_WORK_PANEL_OPEN_TABS]
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
      workPanelOpenTabs: [...DEFAULT_WORK_PANEL_OPEN_TABS],
      workPanelActiveTab: DEFAULT_WORK_PANEL_ACTIVE_TAB,
      toggleLeftCollapsed: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
      toggleRightCollapsed: () =>
        set((s) => {
          const nextCollapsed = !s.rightCollapsed
          if (!nextCollapsed && s.workPanelOpenTabs.length === 0) {
            return {
              rightCollapsed: false,
              workPanelActiveTab: DEFAULT_WORK_PANEL_ACTIVE_TAB,
              workPanelOpenTabs: [...DEFAULT_WORK_PANEL_OPEN_TABS],
            }
          }
          return { rightCollapsed: nextCollapsed }
        }),
      toggleWideScreen: (value) =>
        set((s) => ({
          wideScreen: typeof value === 'boolean' ? value : !s.wideScreen,
        })),
      setLeftCollapsed: (leftCollapsed) => set({ leftCollapsed }),
      setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
      openWorkPanelTab: (tab) => {
        if (!WORK_PANEL_TAB_BY_ID[tab]?.implemented) return
        set((s) => ({
          rightCollapsed: false,
          workPanelActiveTab: tab,
          workPanelOpenTabs: s.workPanelOpenTabs.includes(tab) ? s.workPanelOpenTabs : [...s.workPanelOpenTabs, tab],
        }))
      },
      closeWorkPanelTab: (tab) => {
        const current = get().workPanelOpenTabs
        const next = current.filter((item) => item !== tab)
        if (next.length === 0) {
          set({ rightCollapsed: true, workPanelOpenTabs: next })
          return
        }
        const activeTab = get().workPanelActiveTab === tab ? next[next.length - 1]! : get().workPanelActiveTab
        set({ workPanelActiveTab: activeTab, workPanelOpenTabs: next })
      },
      setWorkPanelActiveTab: (tab) => {
        if (!get().workPanelOpenTabs.includes(tab)) return
        set({ workPanelActiveTab: tab })
      },
      openParamsPanel: () => {
        const { rightCollapsed, workPanelActiveTab, workPanelOpenTabs } = get()
        const paramsOpen = !rightCollapsed && workPanelActiveTab === 'params' && workPanelOpenTabs.includes('params')
        if (paramsOpen) {
          set({ rightCollapsed: true })
          return
        }
        set({
          rightCollapsed: false,
          workPanelActiveTab: 'params',
          workPanelOpenTabs: workPanelOpenTabs.includes('params')
            ? workPanelOpenTabs
            : [...workPanelOpenTabs, 'params'],
        })
      },
      getParams: (agentId) => get().paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS,
      setParams: (agentId, patch) => {
        set((s) => ({
          paramsByAgent: {
            ...s.paramsByAgent,
            [agentId]: {
              ...(s.paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS),
              ...patch,
            },
          },
        }))
      },
      setSearchMode: (agentId, mode) => {
        set((s) => ({
          searchModeByAgent: {
            ...s.searchModeByAgent,
            [agentId]: mode,
          },
        }))
      },
      setTopicGroupMode: (topicGroupMode) => set({ topicGroupMode }),
      setTopicPageSize: (topicPageSize) => set({ topicPageSize }),
      setTopicSortBy: (topicSortBy) => set({ topicSortBy }),
    }),
    {
      name: 'purechat:chat:v2:ui',
      version: 6,
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
        if (version < 5) {
          state = { ...state, searchModeByAgent: {} }
        }
        if (version < 6) {
          state = {
            ...state,
            workPanelActiveTab: DEFAULT_WORK_PANEL_ACTIVE_TAB,
            workPanelOpenTabs: [...DEFAULT_WORK_PANEL_OPEN_TABS],
          }
        }
        const workPanelOpenTabs = normalizeOpenTabs(state.workPanelOpenTabs)
        const workPanelActiveTab =
          isWorkPanelTabId(state.workPanelActiveTab) && workPanelOpenTabs.includes(state.workPanelActiveTab)
            ? state.workPanelActiveTab
            : (workPanelOpenTabs[0] ?? DEFAULT_WORK_PANEL_ACTIVE_TAB)
        return {
          ...state,
          workPanelActiveTab,
          workPanelOpenTabs,
        }
      },
    }
  )
)
