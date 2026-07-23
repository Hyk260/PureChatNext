'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { PURE_AI_AGENT_ID } from '@/const/home/agents'
import { DEFAULT_HOME_MODEL } from '@/const/home/models'
import { type ActiveCommunityAgent } from '@/features/community/types'

import {
  DEFAULT_HOME_SIDEBAR_STATE,
  type HomeAgentGroup,
  mergeSidebarExpandedKeys,
  normalizePersistedSidebarItems,
  normalizeSidebarExpandedKeys,
} from './sidebarDefaults'

export type HomeAgentMode = 'agent' | 'chat'

interface HomeStoreState {
  activeAgent: ActiveCommunityAgent | null
  agentGroups: HomeAgentGroup[]
  agentMode: HomeAgentMode
  hiddenSidebarSections: string[]
  selectedAgentId: string
  selectedModel: string
  selectedProvider: string
  sidebarCollapsed: boolean
  sidebarExpandedKeys: string[]
  sidebarItems: string[]
  addAgentGroup: (name: string) => void
  clearActiveAgent: () => void
  removeAgentGroup: (groupId: string) => void
  resetSidebarCustomization: () => void
  setActiveAgent: (agent: ActiveCommunityAgent) => void
  setAgentMode: (mode: HomeAgentMode) => void
  setSelectedAgentId: (agentId: string) => void
  setSelectedModel: (provider: string, model: string) => void
  setSidebarAccordionExpandedKeys: (accordionKeys: string[], expandedKeys: string[]) => void
  setHiddenSidebarSections: (sections: string[]) => void
  setSidebarExpandedKeys: (keys: string[]) => void
  setSidebarItems: (items: string[]) => void
  toggleHiddenSidebarSection: (key: string) => void
  toggleSidebarCollapsed: () => void
  updateAgentGroupName: (groupId: string, name: string) => void
  updateAgentGroupSort: (groups: HomeAgentGroup[]) => void
}

const createGroupId = () => `group-${Date.now()}`

export const useHomeStore = create<HomeStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_HOME_SIDEBAR_STATE,
      activeAgent: null,
      agentMode: 'agent',
      selectedAgentId: PURE_AI_AGENT_ID,
      selectedModel: DEFAULT_HOME_MODEL.model,
      selectedProvider: DEFAULT_HOME_MODEL.provider,
      sidebarCollapsed: false,
      addAgentGroup: (name) =>
        set((state) => ({
          agentGroups: [
            ...state.agentGroups,
            {
              id: createGroupId(),
              name,
              sort: state.agentGroups.length,
            },
          ],
        })),
      clearActiveAgent: () => set({ activeAgent: null }),
      removeAgentGroup: (groupId) =>
        set((state) => ({
          agentGroups: state.agentGroups
            .filter((group) => group.id !== groupId)
            .map((group, index) => ({ ...group, sort: index })),
        })),
      resetSidebarCustomization: () =>
        set((state) => ({
          ...DEFAULT_HOME_SIDEBAR_STATE,
          agentGroups: state.agentGroups,
        })),
      setActiveAgent: (agent) => set({ activeAgent: agent }),
      setAgentMode: (mode) => set({ agentMode: mode }),
      setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),
      setSelectedModel: (provider, model) => set({ selectedProvider: provider, selectedModel: model }),
      setSidebarAccordionExpandedKeys: (accordionKeys, expandedKeys) =>
        set((state) => ({
          sidebarExpandedKeys: mergeSidebarExpandedKeys(state.sidebarExpandedKeys, accordionKeys, expandedKeys),
        })),
      setHiddenSidebarSections: (sections) => set({ hiddenSidebarSections: sections }),
      setSidebarExpandedKeys: (keys) => set({ sidebarExpandedKeys: keys }),
      setSidebarItems: (items) => set({ sidebarItems: normalizePersistedSidebarItems(items) }),
      toggleHiddenSidebarSection: (key) => {
        const { hiddenSidebarSections } = get()
        const isHidden = hiddenSidebarSections.includes(key)

        set({
          hiddenSidebarSections: isHidden
            ? hiddenSidebarSections.filter((item) => item !== key)
            : [...hiddenSidebarSections, key],
        })
      },
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      updateAgentGroupName: (groupId, name) =>
        set((state) => ({
          agentGroups: state.agentGroups.map((group) => (group.id === groupId ? { ...group, name } : group)),
        })),
      updateAgentGroupSort: (groups) =>
        set({
          agentGroups: groups.map((group, index) => ({ ...group, sort: index })),
        }),
    }),
    {
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState

        const state = persistedState as Partial<HomeStoreState>

        if (state.sidebarExpandedKeys) {
          state.sidebarExpandedKeys = normalizeSidebarExpandedKeys(state.sidebarExpandedKeys)
        }

        if (version < 2 || state.sidebarItems) {
          state.sidebarItems = normalizePersistedSidebarItems(state.sidebarItems)
        }

        return state
      },
      name: 'pure-home-ui',
      onRehydrateStorage: () => (state) => {
        if (!state) return

        if (state.sidebarExpandedKeys) {
          state.sidebarExpandedKeys = normalizeSidebarExpandedKeys(state.sidebarExpandedKeys)
        }

        state.sidebarItems = normalizePersistedSidebarItems(state.sidebarItems)
      },
      version: 2,
    }
  )
)
