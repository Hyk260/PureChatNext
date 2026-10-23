import { afterEach, describe, expect, it } from 'vitest'

import { PENDING_CHAT_PERMISSION_MODE_KEY } from '@/features/chat/chatLocalStorage'
import { DEFAULT_CHAT_ADVANCED_SETTINGS } from '@pure/types'
import { getChatSettingsKey } from '@/features/chat/advancedSettings'

import { useChatUiStore } from './useChatUiStore'

describe('useChatUiStore search mode', () => {
  afterEach(() => {
    useChatUiStore.setState({
      advancedSettingsByAgent: {},
      permissionMode: 'auto',
      permissionModeInitialized: false,
      searchMode: 'off',
    })
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
    expect(JSON.parse(localStorage.getItem('purechat:chat:v2:ui') || '{}').version).toBe(11)
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

  it('drops the old chat-only sidebar switch without resetting other current preferences', async () => {
    localStorage.setItem(
      'purechat:chat:v2:ui',
      JSON.stringify({
        state: {
          leftCollapsed: true,
          rightCollapsed: false,
          wideScreen: true,
          searchMode: 'auto',
          permissionMode: 'full',
          permissionModeInitialized: true,
        },
        version: 9,
      })
    )

    await useChatUiStore.persist.rehydrate()

    expect(useChatUiStore.getState()).not.toHaveProperty('leftCollapsed')
    expect(useChatUiStore.getState()).toMatchObject({
      rightCollapsed: false,
      wideScreen: true,
      searchMode: 'auto',
      permissionMode: 'full',
      permissionModeInitialized: true,
    })
    const persisted = JSON.parse(localStorage.getItem('purechat:chat:v2:ui') || '{}')
    expect(persisted.state).not.toHaveProperty('leftCollapsed')
    expect(persisted.version).toBe(11)
  })

  it('persists advanced settings independently for each account and agent', async () => {
    const { setAdvancedSettings } = useChatUiStore.getState()
    setAdvancedSettings('user-a', 'inbox', { historyCount: 8, enableHistoryCount: true })
    setAdvancedSettings('user-b', 'inbox', { inputTemplate: '翻译：{{text}}' })
    const saved = localStorage.getItem('purechat:chat:v2:ui')!
    useChatUiStore.setState({ advancedSettingsByAgent: {} })
    localStorage.setItem('purechat:chat:v2:ui', saved)
    await useChatUiStore.persist.rehydrate()
    const settings = useChatUiStore.getState().advancedSettingsByAgent
    expect(settings[getChatSettingsKey('user-a', 'inbox')]).toEqual({
      ...DEFAULT_CHAT_ADVANCED_SETTINGS,
      historyCount: 8,
      enableHistoryCount: true,
    })
    expect(settings[getChatSettingsKey('user-b', 'inbox')]).toEqual({
      ...DEFAULT_CHAT_ADVANCED_SETTINGS,
      inputTemplate: '翻译：{{text}}',
    })
    expect(settings[getChatSettingsKey('user-a', 'other-agent')]).toBeUndefined()
  })

  it('drops unused sampling values when migrating without interpreting them as advanced settings', async () => {
    localStorage.setItem(
      'purechat:chat:v2:ui',
      JSON.stringify({
        version: 10,
        state: { paramsByAgent: { inbox: { temperature: 2 } }, wideScreen: true, workPanelOpenTabs: ['params'] },
      })
    )
    await useChatUiStore.persist.rehydrate()
    const persisted = JSON.parse(localStorage.getItem('purechat:chat:v2:ui')!)
    expect(persisted.state).not.toHaveProperty('paramsByAgent')
    expect(persisted.state.advancedSettingsByAgent).toEqual({})
    expect(persisted.state.wideScreen).toBe(true)
    expect(persisted.state.workPanelOpenTabs).toEqual(['params'])
  })
})
