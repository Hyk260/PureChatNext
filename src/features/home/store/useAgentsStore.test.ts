import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import { AgentRequestError, fetchAgents } from '@/features/home/agentApi'

import { useAgentsStore } from './useAgentsStore'

vi.mock('@/features/home/agentApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/home/agentApi')>()
  return {
    ...actual,
    fetchAgents: vi.fn(),
  }
})

const customAgent: AgentListItem = {
  avatar: '🤖',
  description: 'custom',
  id: 'agt_custom',
  isBuiltin: false,
  slug: 'custom',
  systemRole: '',
  title: 'Custom',
}

describe('useAgentsStore', () => {
  beforeEach(() => {
    vi.mocked(fetchAgents).mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useAgentsStore.getState().reset()
  })

  afterEach(() => {
    useAgentsStore.getState().reset()
    vi.restoreAllMocks()
  })

  it('clears loaded user agents back to the builtin default', () => {
    useAgentsStore.setState({ agents: [customAgent], loaded: true, loading: false })

    useAgentsStore.getState().reset()

    expect(useAgentsStore.getState()).toMatchObject({
      agents: [DEFAULT_PURE_AI_META],
      error: null,
      loaded: false,
      loading: false,
    })
  })

  it('replaces the list when unauthorized instead of keeping stale agents', async () => {
    useAgentsStore.setState({ agents: [customAgent], loaded: false })
    vi.mocked(fetchAgents).mockRejectedValue(new AgentRequestError('fetchAgents', 401))

    const agents = await useAgentsStore.getState().fetchAgents()

    expect(agents).toEqual([DEFAULT_PURE_AI_META])
    expect(useAgentsStore.getState()).toMatchObject({
      agents: [DEFAULT_PURE_AI_META],
      error: null,
      loaded: false,
      loading: false,
    })
  })

  it('keeps the current list when a non-auth fetch fails', async () => {
    useAgentsStore.setState({ agents: [customAgent], loaded: false })
    vi.mocked(fetchAgents).mockRejectedValue(new AgentRequestError('fetchAgents', 500))

    const agents = await useAgentsStore.getState().fetchAgents()

    expect(agents).toEqual([customAgent])
    expect(useAgentsStore.getState()).toMatchObject({
      agents: [customAgent],
      error: 'fetchAgents failed: 500',
      loaded: false,
      loading: false,
    })
  })

  it('does not apply a fetch that finishes after reset', async () => {
    let resolveFetch!: (value: AgentListItem[]) => void
    vi.mocked(fetchAgents).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )

    const pending = useAgentsStore.getState().fetchAgents()
    useAgentsStore.getState().reset()
    resolveFetch([customAgent])
    await pending

    expect(useAgentsStore.getState().agents).toEqual([DEFAULT_PURE_AI_META])
    expect(useAgentsStore.getState().loaded).toBe(false)
  })
})
