import { afterEach, describe, expect, it } from 'vitest'

import { useChatUiStore } from './useChatUiStore'

describe('useChatUiStore search mode', () => {
  afterEach(() => {
    useChatUiStore.setState({ searchMode: 'off' })
    localStorage.clear()
  })

  it('defaults to off when no persisted value exists', () => {
    expect(useChatUiStore.getState().searchMode).toBe('off')
  })

  it('stores one shared search mode', () => {
    useChatUiStore.getState().setSearchMode('auto')
    expect(useChatUiStore.getState().searchMode).toBe('auto')

    const persisted = JSON.parse(localStorage.getItem('purechat:chat:v2:ui') || '{}')
    expect(persisted.state.searchMode).toBe('auto')
  })

  it('opens params panel and toggles closed when already active', () => {
    useChatUiStore.setState({
      rightCollapsed: true,
      workPanelActiveTab: 'overview',
      workPanelOpenTabs: ['overview'],
    })

    useChatUiStore.getState().openParamsPanel()
    expect(useChatUiStore.getState()).toMatchObject({
      rightCollapsed: false,
      workPanelActiveTab: 'params',
      workPanelOpenTabs: ['overview', 'params'],
    })

    useChatUiStore.getState().openParamsPanel()
    expect(useChatUiStore.getState().rightCollapsed).toBe(true)
  })
})
