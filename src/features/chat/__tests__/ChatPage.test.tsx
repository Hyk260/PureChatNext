import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocalChatTopic } from '@/features/chat/types'
import { setPendingChatPermissionMode, setPendingTopicSend } from '@/features/chat/chatLocalStorage'

const mocks = vi.hoisted(() => {
  const navigation = {
    listeners: new Set<() => void>(),
    query: 'agent=agt_inbox',
  }
  const desktopApi = { requestFullAccess: vi.fn().mockResolvedValue({ granted: true }) }

  return {
    autoRenameTopic: vi.fn(),
    createTopic: vi.fn(),
    desktop: false,
    desktopApi,
    permissionModeInitialized: true,
    fetchAgents: vi.fn(),
    fetchMessages: vi.fn(),
    fetchTopics: vi.fn(),
    navigation,
    permissionMode: 'auto' as 'ask' | 'auto' | 'full',
    initializePermissionMode: vi.fn((mode: 'ask' | 'auto' | 'full') => {
      mocks.permissionMode = mode
      mocks.permissionModeInitialized = true
    }),
    searchMode: 'off' as 'auto' | 'off',
    chatError: undefined as Error | undefined,
    clearChatError: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    updateTopic: vi.fn(),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (href: string) => {
      mocks.navigation.query = href.split('?')[1] ?? ''
      mocks.navigation.listeners.forEach((listener) => listener())
    },
    replace: (href: string) => {
      mocks.navigation.query = href.split('?')[1] ?? ''
      mocks.navigation.listeners.forEach((listener) => listener())
    },
  }),
  useSearchParams: () => {
    const query = React.useSyncExternalStore(
      (listener) => {
        mocks.navigation.listeners.add(listener)
        return () => mocks.navigation.listeners.delete(listener)
      },
      () => mocks.navigation.query,
      () => mocks.navigation.query
    )

    return React.useMemo(() => new URLSearchParams(query), [query])
  },
}))

vi.mock('@ai-sdk/react', () => ({
  useChat: ({ messages = [] }: { messages?: UIMessage[] }) => ({
    clearError: mocks.clearChatError,
    error: mocks.chatError,
    messages,
    sendMessage: mocks.sendMessage,
    setMessages: vi.fn(),
    status: 'ready',
    stop: vi.fn(),
  }),
}))

vi.mock('ai', () => ({
  DefaultChatTransport: class {},
}))

vi.mock('@pure/ui', () => ({
  Flex: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}))

vi.mock('@/features/chat/chatApi', () => ({
  autoRenameTopic: mocks.autoRenameTopic,
  buildChatHref: (agentId: string, topicId?: string | null) => {
    const params = new URLSearchParams({ agent: agentId })
    if (topicId) params.set('topic', topicId)
    return `/chat?${params.toString()}`
  },
  createTopic: mocks.createTopic,
  deleteTopic: vi.fn(),
  deleteTopics: vi.fn(),
  fetchMessages: mocks.fetchMessages,
  fetchTopics: mocks.fetchTopics,
  putMessages: vi.fn().mockResolvedValue(undefined),
  updateTopic: mocks.updateTopic,
}))

vi.mock('@/features/chat/ChatInput', () => ({
  default: ({
    onPermissionModeChange,
    onSend,
    permissionMode,
  }: {
    onPermissionModeChange?: (mode: 'ask' | 'full') => void
    onSend: (text: string) => void
    permissionMode?: string
  }) => (
    <>
      <button type='button' onClick={() => onSend('hello')}>
        send
      </button>
      {permissionMode ? (
        <>
          <button
            aria-label={`权限模式：${permissionMode}`}
            type='button'
            onClick={() => onPermissionModeChange?.('ask')}
          >
            permission
          </button>
          <button aria-label='切换到完全访问权限' type='button' onClick={() => onPermissionModeChange?.('full')}>
            full permission
          </button>
        </>
      ) : null}
    </>
  ),
}))

vi.mock('@/features/chat/ChatLayout', () => ({
  default: ({
    autoRenamingTopicId,
    children,
    onAutoRenameTopic,
  }: {
    autoRenamingTopicId: string | null
    children?: React.ReactNode
    onAutoRenameTopic: (id: string) => void
  }) => (
    <main>
      <span data-testid='auto-renaming-topic-id'>{autoRenamingTopicId ?? 'none'}</span>
      <button type='button' onClick={() => onAutoRenameTopic('topic-rename')}>
        auto rename
      </button>
      {children}
    </main>
  ),
}))

vi.mock('@/features/chat/ChatMessages', () => ({
  default: ({ messages }: { messages: UIMessage[] }) => <div data-testid='messages'>{messages.length}</div>,
}))

vi.mock('@/features/chat/ChatMessagesSkeleton', () => ({
  default: () => <div data-testid='messages-skeleton' />,
}))

vi.mock('@/features/chat/WorkPanel', () => ({ default: () => null }))
vi.mock('@/features/chat/TopicSidebar', () => ({ default: () => null }))
vi.mock('@/features/chat/WideScreenContainer', () => ({
  CONVERSATION_MAX_WIDTH: 960,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: unknown) => unknown) =>
    selector({
      paramsByAgent: {},
      permissionMode: mocks.permissionMode,
      permissionModeInitialized: mocks.permissionModeInitialized,
      searchMode: mocks.searchMode,
      wideScreen: false,
      setParams: vi.fn(),
      setPermissionMode: (mode: 'ask' | 'auto' | 'full') => {
        mocks.permissionMode = mode
      },
      initializePermissionMode: mocks.initializePermissionMode,
      setSearchMode: vi.fn(),
    }),
}))

vi.mock('@/features/home/agentApi', () => ({ fetchAgent: vi.fn() }))

vi.mock('@/features/home/store/useAgentsStore', () => ({
  useAgentsStore: (selector: (state: unknown) => unknown) =>
    selector({ agents: [], fetchAgents: mocks.fetchAgents, upsertLocal: vi.fn() }),
}))

vi.mock('@/features/home/store/useHomeStore', () => {
  const state = {
    activeAgent: { identifier: 'agt_inbox', systemRole: '', title: 'Inbox' },
    selectedAgentId: 'agt_inbox',
    selectedModel: 'test-model',
    selectedProvider: 'purechat',
    setActiveAgent: vi.fn(),
    setSelectedAgentId: vi.fn(),
  }
  const useHomeStore = Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
    getState: () => state,
  })

  return { useHomeStore }
})

vi.mock('@/features/settings/provider/const', () => ({
  isSettingsProviderId: () => true,
}))

vi.mock('@/features/settings/provider/store/useProviderConfigStore', () => {
  const state = { configs: { purechat: { apiKey: '', baseURL: '', models: [] } } }
  const useProviderConfigStore = Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
    getState: () => state,
  })

  return { useProviderConfigStore }
})

vi.mock('@/types/desktop', () => ({ getDesktopApi: () => (mocks.desktop ? mocks.desktopApi : undefined) }))

import ChatPage from '@/features/chat/ChatPage'

const createdTopic = {
  agentId: 'agt_inbox',
  createdAt: 1,
  favorite: false,
  id: 'topic-new',
  permissionMode: 'auto' as const,
  projectName: null,
  title: 'hello',
  updatedAt: 1,
}

describe('ChatPage message loading state', () => {
  beforeEach(() => {
    mocks.navigation.query = 'agent=agt_inbox'
    mocks.navigation.listeners.clear()
    mocks.autoRenameTopic.mockReset()
    mocks.createTopic.mockReset().mockResolvedValue(createdTopic)
    mocks.desktop = false
    mocks.permissionModeInitialized = true
    mocks.fetchMessages.mockReset().mockReturnValue(new Promise(() => {}))
    mocks.fetchTopics.mockReset().mockResolvedValue([])
    mocks.fetchAgents.mockReset()
    mocks.updateTopic.mockReset()
    mocks.sendMessage.mockClear()
    mocks.clearChatError.mockClear()
    mocks.chatError = undefined
    mocks.searchMode = 'off'
    mocks.permissionMode = 'auto'
    mocks.initializePermissionMode.mockClear()
    mocks.desktopApi.requestFullAccess.mockClear()
    setPendingChatPermissionMode('auto')
    setPendingTopicSend('')
  })

  it('opens a newly-created topic without showing a message skeleton', async () => {
    render(<ChatPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'send' }))

    await waitFor(() => {
      expect(mocks.navigation.query).toBe('agent=agt_inbox&topic=topic-new')
      expect(screen.queryByTestId('messages-skeleton')).toBeNull()
      expect(screen.getByTestId('messages').textContent).toBe('0')
    })
    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith({ text: 'hello' }, expect.any(Object)))
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      { text: 'hello' },
      { body: expect.objectContaining({ searchMode: 'off' }) }
    )
    expect(mocks.sendMessage.mock.calls.at(-1)?.[1]?.body).not.toHaveProperty('permissionMode')
  })

  it('keeps auto search enabled through the new-topic send handoff', async () => {
    mocks.searchMode = 'auto'
    render(<ChatPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'send' }))

    await waitFor(() =>
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        { text: 'hello' },
        { body: expect.objectContaining({ searchMode: 'auto' }) }
      )
    )
  })

  it('passes desktop draft permissions into topic creation and chat requests', async () => {
    mocks.desktop = true
    render(<ChatPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'send' }))

    await waitFor(() => expect(mocks.createTopic).toHaveBeenCalledWith('agt_inbox', 'hello', 'auto', undefined))
    await waitFor(() =>
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        { text: 'hello' },
        { body: expect.objectContaining({ permissionMode: 'auto' }) }
      )
    )
  })

  it('persists desktop permission changes for an existing topic', async () => {
    const existingTopic = { ...createdTopic, id: 'topic-existing', permissionMode: 'full' as const }
    mocks.permissionMode = 'full'
    mocks.desktop = true
    mocks.navigation.query = 'agent=agt_inbox&topic=topic-existing'
    mocks.fetchTopics.mockResolvedValue([existingTopic])
    mocks.fetchMessages.mockResolvedValue([])
    mocks.updateTopic.mockResolvedValue({ ...existingTopic, permissionMode: 'ask' })

    render(<ChatPage />)
    fireEvent.click(await screen.findByRole('button', { name: '权限模式：full' }))

    await waitFor(() => expect(mocks.updateTopic).toHaveBeenCalledWith('topic-existing', { permissionMode: 'ask' }))
    expect(await screen.findByRole('button', { name: '权限模式：ask' })).toBeTruthy()
  })

  it('keeps the active topic when switching it to full access', async () => {
    const existingTopic = { ...createdTopic, id: 'topic-existing', permissionMode: 'auto' as const }
    mocks.desktop = true
    mocks.navigation.query = 'agent=agt_inbox&topic=topic-existing'
    mocks.fetchTopics.mockResolvedValue([existingTopic])
    mocks.fetchMessages.mockResolvedValue([])
    mocks.updateTopic.mockResolvedValue({ ...existingTopic, permissionMode: 'full' })

    render(<ChatPage />)
    fireEvent.click(await screen.findByRole('button', { name: '切换到完全访问权限' }))

    await waitFor(() => expect(mocks.updateTopic).toHaveBeenCalledWith('topic-existing', { permissionMode: 'full' }))
    expect(mocks.desktopApi.requestFullAccess).toHaveBeenCalledTimes(1)
    expect(mocks.desktopApi.requestFullAccess).toHaveBeenCalledWith('topic-existing')
    expect(mocks.createTopic).not.toHaveBeenCalled()
    expect(mocks.navigation.query).toBe('agent=agt_inbox&topic=topic-existing')
  })

  it('keeps an existing conversation mounted while its full access setting syncs', async () => {
    const existingTopic = { ...createdTopic, id: 'topic-existing', permissionMode: 'auto' as const }
    let finishTopicUpdate: (topic: LocalChatTopic) => void = () => {}
    mocks.desktop = true
    mocks.permissionMode = 'full'
    mocks.navigation.query = 'agent=agt_inbox&topic=topic-existing'
    mocks.fetchTopics.mockResolvedValue([existingTopic])
    mocks.fetchMessages.mockResolvedValue([])
    mocks.updateTopic.mockReturnValue(
      new Promise<LocalChatTopic>((resolve) => {
        finishTopicUpdate = resolve
      })
    )

    render(<ChatPage />)

    expect(await screen.findByTestId('messages')).toBeTruthy()
    expect(screen.queryByTestId('messages-skeleton')).toBeNull()
    await waitFor(() => expect(mocks.updateTopic).toHaveBeenCalledWith('topic-existing', { permissionMode: 'full' }))
    finishTopicUpdate({ ...existingTopic, permissionMode: 'full' })
  })

  it('does not initialize local desktop access from a remote full permission setting', async () => {
    const existingTopic = { ...createdTopic, id: 'topic-existing', permissionMode: 'full' as const }
    mocks.desktop = true
    mocks.permissionModeInitialized = false
    mocks.permissionMode = 'auto'
    setPendingChatPermissionMode('ask')
    mocks.navigation.query = 'agent=agt_inbox&topic=topic-existing'
    mocks.fetchTopics.mockResolvedValue([existingTopic])
    mocks.fetchMessages.mockResolvedValue([])
    mocks.updateTopic.mockResolvedValue({ ...existingTopic, permissionMode: 'ask' })

    render(<ChatPage />)

    await waitFor(() => expect(mocks.initializePermissionMode).toHaveBeenCalledWith('ask'))
    expect(mocks.desktopApi.requestFullAccess).not.toHaveBeenCalled()
  })

  it('keeps the message skeleton for an uncached existing topic', async () => {
    mocks.navigation.query = 'agent=agt_inbox&topic=topic-existing'

    render(<ChatPage />)

    expect(await screen.findByTestId('messages-skeleton')).toBeTruthy()
    expect(screen.queryByTestId('messages')).toBeNull()
  })

  it('renders a dismissible send error without adding a message row', async () => {
    mocks.chatError = new Error('发送失败')

    render(<ChatPage />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('发送失败')
    expect(alert.parentElement?.parentElement?.className).toContain('absolute')
    expect(screen.getByTestId('messages').textContent).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: '关闭错误提示' }))

    expect(mocks.clearChatError).toHaveBeenCalledOnce()
  })

  it('clears the shared auto rename state after success', async () => {
    let resolveRename: (topic: typeof createdTopic) => void = () => {}
    mocks.autoRenameTopic.mockReturnValue(
      new Promise((resolve) => {
        resolveRename = resolve
      })
    )
    render(<ChatPage />)

    fireEvent.click(screen.getByRole('button', { name: 'auto rename' }))
    fireEvent.click(screen.getByRole('button', { name: 'auto rename' }))
    expect(mocks.autoRenameTopic).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('auto-renaming-topic-id').textContent).toBe('topic-rename')

    resolveRename({ ...createdTopic, id: 'topic-rename', title: '智能标题' })
    await waitFor(() => expect(screen.getByTestId('auto-renaming-topic-id').textContent).toBe('none'))
  })

  it('clears the shared auto rename state after failure', async () => {
    let rejectRename: (error: Error) => void = () => {}
    mocks.autoRenameTopic.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRename = reject
      })
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ChatPage />)

    fireEvent.click(screen.getByRole('button', { name: 'auto rename' }))
    expect(screen.getByTestId('auto-renaming-topic-id').textContent).toBe('topic-rename')

    rejectRename(new Error('rename failed'))
    await waitFor(() => expect(screen.getByTestId('auto-renaming-topic-id').textContent).toBe('none'))
    consoleError.mockRestore()
  })
})
