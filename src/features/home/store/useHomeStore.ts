'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_HOME_AGENT_ID } from '@/const/home/agents'
import { DEFAULT_HOME_MODEL } from '@/const/home/models'

import {
  DEFAULT_HOME_SIDEBAR_STATE,
  type HomeAgentGroup,
  mergeSidebarExpandedKeys,
  normalizeSidebarExpandedKeys,
} from './sidebarDefaults'

export type HomeAgentMode = 'agent' | 'chat'

interface HomeStoreState {
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
  removeAgentGroup: (groupId: string) => void
  resetSidebarCustomization: () => void
  setAgentMode: (mode: HomeAgentMode) => void
  setSelectedAgentId: (agentId: string) => void
  setSelectedModel: (provider: string, model: string) => void
  setSidebarAccordionExpandedKeys: (accordionKeys: string[], expandedKeys: string[]) => void
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
      agentMode: 'agent',
      selectedAgentId: DEFAULT_HOME_AGENT_ID,
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
      setAgentMode: (mode) => set({ agentMode: mode }),
      setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),
      setSelectedModel: (provider, model) =>
        set({ selectedProvider: provider, selectedModel: model }),
      setSidebarAccordionExpandedKeys: (accordionKeys, expandedKeys) =>
        set((state) => ({
          sidebarExpandedKeys: mergeSidebarExpandedKeys(
            state.sidebarExpandedKeys,
            accordionKeys,
            expandedKeys,
          ),
        })),
      setSidebarExpandedKeys: (keys) => set({ sidebarExpandedKeys: keys }),
      setSidebarItems: (items) => set({ sidebarItems: items }),
      toggleHiddenSidebarSection: (key) => {
        const { hiddenSidebarSections } = get()
        const isHidden = hiddenSidebarSections.includes(key)

        set({
          hiddenSidebarSections: isHidden
            ? hiddenSidebarSections.filter((item) => item !== key)
            : [...hiddenSidebarSections, key],
        })
      },
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      updateAgentGroupName: (groupId, name) =>
        set((state) => ({
          agentGroups: state.agentGroups.map((group) =>
            group.id === groupId ? { ...group, name } : group,
          ),
        })),
      updateAgentGroupSort: (groups) =>
        set({
          agentGroups: groups.map((group, index) => ({ ...group, sort: index })),
        }),
    }),
    {
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState

        const state = persistedState as Partial<HomeStoreState>

        if (state.sidebarExpandedKeys) {
          state.sidebarExpandedKeys = normalizeSidebarExpandedKeys(state.sidebarExpandedKeys)
        }

        return state
      },
      name: 'pure-home-ui',
      onRehydrateStorage: () => (state) => {
        if (!state?.sidebarExpandedKeys) return

        state.sidebarExpandedKeys = normalizeSidebarExpandedKeys(state.sidebarExpandedKeys)
      },
      version: 1,
    },
  ),
)
