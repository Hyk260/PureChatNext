'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { WorkPanelTabId } from '@/features/chat/WorkPanel/tabs'
import {
  DEFAULT_WORK_PANEL_ACTIVE_TAB,
  DEFAULT_WORK_PANEL_OPEN_TABS,
  isWorkPanelTabId,
} from '@/features/chat/WorkPanel/tabs'
import { chatAdvancedSettingsSchema, getChatSettingsKey } from '@/features/chat/advancedSettings'
import type { ChatSearchMode, TopicGroupMode, TopicPageSize, TopicSortBy } from '@/features/chat/types'
import { PENDING_CHAT_PERMISSION_MODE_KEY } from '@/features/chat/chatLocalStorage'
import { CHAT_PERMISSION_MODES, DEFAULT_CHAT_ADVANCED_SETTINGS, DEFAULT_CHAT_PERMISSION_MODE } from '@pure/types'
import type { ChatAdvancedSettings, ChatPermissionMode } from '@pure/types'
import { sessionStg } from '@pure/utils/storage'

type ChatUiState = {
  rightCollapsed: boolean
  /** true = 聊天区占满主栏宽度；false = 居中限宽 */
  wideScreen: boolean
  advancedSettingsByAgent: Record<string, ChatAdvancedSettings>
  /** Shared across all agents */
  searchMode: ChatSearchMode
  /** Shared permission mode across all conversations */
  permissionMode: ChatPermissionMode
  permissionModeInitialized: boolean
  topicGroupMode: TopicGroupMode
  topicPageSize: TopicPageSize
  topicSortBy: TopicSortBy
  workPanelOpenTabs: WorkPanelTabId[]
  workPanelActiveTab: WorkPanelTabId
  toggleRightCollapsed: () => void
  toggleWideScreen: (value?: boolean) => void
  setRightCollapsed: (v: boolean) => void
  openWorkPanelTab: (tab: WorkPanelTabId) => void
  closeWorkPanelTab: (tab: WorkPanelTabId) => void
  setWorkPanelActiveTab: (tab: WorkPanelTabId) => void
  openParamsPanel: () => void
  setAdvancedSettings: (userId: string, agentId: string, patch: Partial<ChatAdvancedSettings>) => void
  setSearchMode: (mode: ChatSearchMode) => void
  setPermissionMode: (mode: ChatPermissionMode) => void
  initializePermissionMode: (mode: ChatPermissionMode) => void
  setTopicGroupMode: (mode: TopicGroupMode) => void
  setTopicPageSize: (pageSize: TopicPageSize) => void
  setTopicSortBy: (sortBy: TopicSortBy) => void
}

function normalizeOpenTabs(tabs: unknown): WorkPanelTabId[] {
  if (!Array.isArray(tabs)) return [...DEFAULT_WORK_PANEL_OPEN_TABS]
  const next = tabs.filter((tab): tab is WorkPanelTabId => isWorkPanelTabId(tab))
  return next.length > 0 ? next : [...DEFAULT_WORK_PANEL_OPEN_TABS]
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set, get) => ({
      rightCollapsed: true,
      wideScreen: false,
      advancedSettingsByAgent: {},
      searchMode: 'off',
      permissionMode: DEFAULT_CHAT_PERMISSION_MODE,
      permissionModeInitialized: false,
      topicGroupMode: 'byTime',
      topicPageSize: 40,
      topicSortBy: 'updatedAt',
      workPanelOpenTabs: [...DEFAULT_WORK_PANEL_OPEN_TABS],
      workPanelActiveTab: DEFAULT_WORK_PANEL_ACTIVE_TAB,
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
      setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
      openWorkPanelTab: (tab) => {
        if (!isWorkPanelTabId(tab)) return
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
      setAdvancedSettings: (userId, agentId, patch) => {
        const key = getChatSettingsKey(userId, agentId)
        set((s) => ({
          advancedSettingsByAgent: {
            ...s.advancedSettingsByAgent,
            [key]: {
              ...(s.advancedSettingsByAgent[key] ?? DEFAULT_CHAT_ADVANCED_SETTINGS),
              ...patch,
            },
          },
        }))
      },
      setSearchMode: (searchMode) => set({ searchMode }),
      setPermissionMode: (permissionMode) => set({ permissionMode, permissionModeInitialized: true }),
      initializePermissionMode: (permissionMode) =>
        set((state) => (state.permissionModeInitialized ? state : { permissionMode, permissionModeInitialized: true })),
      setTopicGroupMode: (topicGroupMode) => set({ topicGroupMode }),
      setTopicPageSize: (topicPageSize) => set({ topicPageSize }),
      setTopicSortBy: (topicSortBy) => set({ topicSortBy }),
    }),
    {
      name: 'purechat:chat:v2:ui',
      version: 11,
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
        if (version < 6) {
          state = {
            ...state,
            workPanelActiveTab: DEFAULT_WORK_PANEL_ACTIVE_TAB,
            workPanelOpenTabs: [...DEFAULT_WORK_PANEL_OPEN_TABS],
          }
        }
        // 左侧栏已统一使用全局开关，丢弃聊天页过去独立保存的折叠状态。
        const {
          searchModeByAgent: _dropped,
          leftCollapsed: _leftCollapsed,
          paramsByAgent: _paramsByAgent,
          ...rest
        } = state
        const advancedSettingsByAgent: Record<string, ChatAdvancedSettings> = {}
        const storedSettings = rest.advancedSettingsByAgent
        if (storedSettings && typeof storedSettings === 'object') {
          for (const [key, value] of Object.entries(storedSettings)) {
            const parsed = chatAdvancedSettingsSchema.safeParse(value)
            if (parsed.success) advancedSettingsByAgent[key] = parsed.data
          }
        }
        const workPanelOpenTabs = normalizeOpenTabs(rest.workPanelOpenTabs)
        const workPanelActiveTab =
          isWorkPanelTabId(rest.workPanelActiveTab) && workPanelOpenTabs.includes(rest.workPanelActiveTab)
            ? rest.workPanelActiveTab
            : (workPanelOpenTabs[0] ?? DEFAULT_WORK_PANEL_ACTIVE_TAB)
        const resetPersistedFullPermission = version < 9 && rest.permissionMode === 'full'
        const resetPendingFullPermission =
          version < 9 && sessionStg.getString(PENDING_CHAT_PERMISSION_MODE_KEY) === 'full'
        const resetLocalFullPermission = resetPersistedFullPermission || resetPendingFullPermission
        if (resetLocalFullPermission) sessionStg.remove(PENDING_CHAT_PERMISSION_MODE_KEY)
        const permissionMode =
          !resetLocalFullPermission && CHAT_PERMISSION_MODES.includes(rest.permissionMode as ChatPermissionMode)
            ? (rest.permissionMode as ChatPermissionMode)
            : DEFAULT_CHAT_PERMISSION_MODE
        return {
          ...rest,
          advancedSettingsByAgent,
          permissionMode,
          permissionModeInitialized: resetLocalFullPermission ? false : rest.permissionModeInitialized === true,
          searchMode: rest.searchMode === 'auto' ? 'auto' : 'off',
          workPanelActiveTab,
          workPanelOpenTabs,
        }
      },
    }
  )
)
