import { afterEach, describe, expect, it } from 'vitest'

import { useChatUiStore } from './useChatUiStore'

describe('useChatUiStore search mode', () => {
  afterEach(() => {
    useChatUiStore.setState({ searchModeByAgent: {} })
    localStorage.clear()
  })

  it('defaults each agent to off when no persisted value exists', () => {
    expect(useChatUiStore.getState().searchModeByAgent['agent-1'] ?? 'off').toBe('off')
  })

  it('stores search mode independently for each agent', () => {
    useChatUiStore.getState().setSearchMode('agent-1', 'auto')
    useChatUiStore.getState().setSearchMode('agent-2', 'off')

    expect(useChatUiStore.getState().searchModeByAgent).toEqual({
      'agent-1': 'auto',
      'agent-2': 'off',
    })

    const persisted = JSON.parse(localStorage.getItem('purechat:chat:v2:ui') || '{}')
    expect(persisted.state.searchModeByAgent).toEqual({ 'agent-1': 'auto', 'agent-2': 'off' })
  })

  it('migrates older persisted state with search disabled', async () => {
    const migrate = useChatUiStore.persist.getOptions().migrate
    if (!migrate) throw new Error('Expected a persisted state migration')

    const migrated = (await migrate({ topicGroupMode: 'flat' }, 4)) as Record<string, unknown>

    expect(migrated).toEqual({ searchModeByAgent: {}, topicGroupMode: 'flat' })
  })
})
