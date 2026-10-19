import { afterEach, describe, expect, it } from 'vitest'

import { PENDING_CHAT_PERMISSION_MODE_KEY } from '@/features/chat/chatLocalStorage'

import { useChatUiStore } from './useChatUiStore'

describe('useChatUiStore search mode', () => {
  afterEach(() => {
    useChatUiStore.setState({ permissionMode: 'auto', permissionModeInitialized: false, searchMode: 'off' })
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

  it('resets a persisted full permission mode when migrating from the vulnerable version', async () => {
    sessionStorage.setItem(PENDING_CHAT_PERMISSION_MODE_KEY, 'full')
    localStorage.setItem(
      'purechat:chat:v2:ui',
      JSON.stringify({
        state: { permissionMode: 'full', permissionModeInitialized: true, searchMode: 'off' },
        version: 8,
      })
    )

    await useChatUiStore.persist.rehydrate()

    expect(useChatUiStore.getState()).toMatchObject({ permissionMode: 'auto', permissionModeInitialized: false })
    expect(JSON.parse(localStorage.getItem('purechat:chat:v2:ui') || '{}').version).toBe(9)
    expect(sessionStorage.getItem(PENDING_CHAT_PERMISSION_MODE_KEY)).toBeNull()

    sessionStorage.setItem(PENDING_CHAT_PERMISSION_MODE_KEY, 'full')
    localStorage.setItem(
      'purechat:chat:v2:ui',
      JSON.stringify({
        state: { permissionMode: 'auto', permissionModeInitialized: true, searchMode: 'off' },
        version: 8,
      })
    )
    await useChatUiStore.persist.rehydrate()

    expect(useChatUiStore.getState()).toMatchObject({ permissionMode: 'auto', permissionModeInitialized: false })
    expect(sessionStorage.getItem(PENDING_CHAT_PERMISSION_MODE_KEY)).toBeNull()
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
