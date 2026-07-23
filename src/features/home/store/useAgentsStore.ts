import { create } from 'zustand'

import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID, type AgentListItem } from '@/const/home/agents'
import { fetchAgents } from '@/features/home/agentApi'

interface AgentsStoreState {
  agents: AgentListItem[]
  error: string | null
  loaded: boolean
  loading: boolean
  fetchAgents: () => Promise<AgentListItem[]>
  findById: (id: string) => AgentListItem | undefined
  removeLocal: (id: string) => void
  upsertLocal: (agent: AgentListItem) => void
}

export const useAgentsStore = create<AgentsStoreState>((set, get) => ({
  agents: [DEFAULT_PURE_AI_META],
  error: null,
  loaded: false,
  loading: false,

  fetchAgents: async () => {
    set({ loading: true, error: null })
    try {
      const agents = await fetchAgents()
      set({ agents, loaded: true, loading: false })
      return agents
    } catch (error) {
      console.error('[agents] fetch failed:', error)
      set({
        error: error instanceof Error ? error.message : 'fetch failed',
        loading: false,
      })
      return get().agents
    }
  },

  findById: (id) => get().agents.find((agent) => agent.id === id),

  removeLocal: (id) =>
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
    })),

  upsertLocal: (agent) =>
    set((state) => {
      const index = state.agents.findIndex((item) => item.id === agent.id)
      if (index === -1) {
        return { agents: [...state.agents, agent] }
      }
      const next = [...state.agents]
      next[index] = agent
      return { agents: next }
    }),
}))

export const resolveAgentMeta = (id: string): AgentListItem => {
  return (
    useAgentsStore.getState().findById(id) ?? {
      ...DEFAULT_PURE_AI_META,
      id: id || PURE_AI_AGENT_ID,
    }
  )
}
