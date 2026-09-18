import { create } from 'zustand'

import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import { AgentRequestError, fetchAgents } from '@/features/home/agentApi'

type FetchAgentsOptions = {
  /** Bypass cache and in-flight reuse (e.g. after pin/unpin). */
  force?: boolean
}

interface AgentsStoreState {
  agents: AgentListItem[]
  error: string | null
  loaded: boolean
  loading: boolean
  fetchAgents: (options?: FetchAgentsOptions) => Promise<AgentListItem[]>
  findById: (id: string) => AgentListItem | undefined
  removeLocal: (id: string) => void
  reset: () => void
  upsertLocal: (agent: AgentListItem) => void
}

const createInitialAgentsState = () => ({
  agents: [DEFAULT_PURE_AI_META],
  error: null as string | null,
  loaded: false,
  loading: false,
})

/** Share one list request across Strict Mode remounts / multi-mount callers. */
let agentsInflight: Promise<AgentListItem[]> | null = null
let agentsFetchGeneration = 0

function isUnauthorizedAgentError(error: unknown): error is AgentRequestError {
  return error instanceof AgentRequestError && error.status === 401
}

export const useAgentsStore = create<AgentsStoreState>((set, get) => ({
  ...createInitialAgentsState(),

  fetchAgents: async (options) => {
    const force = options?.force === true
    if (!force && get().loaded) return get().agents
    if (!force && agentsInflight) return agentsInflight

    const generation = ++agentsFetchGeneration

    const run = async () => {
      set({ loading: true, error: null })
      try {
        const agents = await fetchAgents()
        if (generation !== agentsFetchGeneration) return get().agents
        set({ agents, loaded: true, loading: false })
        return agents
      } catch (error) {
        console.error('[agents] fetch failed:', error)
        if (generation !== agentsFetchGeneration) return get().agents
        if (isUnauthorizedAgentError(error)) {
          get().reset()
          return get().agents
        }
        set({
          error: error instanceof Error ? error.message : 'fetch failed',
          loading: false,
        })
        return get().agents
      }
    }

    const request = run()
    agentsInflight = request
    void request.finally(() => {
      if (agentsInflight === request) agentsInflight = null
    })
    return request
  },

  findById: (id) => get().agents.find((agent) => agent.id === id),

  removeLocal: (id) => {
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
    }))
  },

  reset: () => {
    agentsFetchGeneration += 1
    agentsInflight = null
    set(createInitialAgentsState())
  },

  upsertLocal: (agent) => {
    set((state) => {
      const index = state.agents.findIndex((item) => item.id === agent.id)
      if (index === -1) {
        return { agents: [...state.agents, agent] }
      }
      const next = [...state.agents]
      next[index] = agent
      return { agents: next }
    })
  },
}))

export const resolveAgentMeta = (id: string): AgentListItem => {
  return (
    useAgentsStore.getState().findById(id) ?? {
      ...DEFAULT_PURE_AI_META,
      id: id || PURE_AI_AGENT_ID,
    }
  )
}
