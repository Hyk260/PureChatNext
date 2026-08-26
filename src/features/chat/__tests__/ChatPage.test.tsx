import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setPendingTopicSend } from '@/features/chat/chatLocalStorage'

const mocks = vi.hoisted(() => {
  const navigation = {
    listeners: new Set<() => void>(),
    query: 'agent=agt_inbox',
  }

  return {
    autoRenameTopic: vi.fn(),
    createTopic: vi.fn(),
    fetchAgents: vi.fn(),
    fetchMessages: vi.fn(),
    fetchTopics: vi.fn(),
    navigation,
    searchMode: 'off' as 'auto' | 'off',
    chatError: undefined as Error | undefined,
    clearChatError: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/utils/navigation', () => ({
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
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
  createTopic: mocks.createTopic,
  deleteTopic: vi.fn(),
  deleteTopics: vi.fn(),
  fetchMessages: mocks.fetchMessages,
  fetchTopics: mocks.fetchTopics,
  putMessages: vi.fn().mockResolvedValue(undefined),
  updateTopic: vi.fn(),
}))

vi.mock('@/features/chat/ChatInput', () => ({
  default: ({ onSend }: { onSend: (text: string) => void }) => (
    <button type='button' onClick={() => onSend('hello')}>
      send
    </button>
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

vi.mock('@/features/chat/ParamsPanel', () => ({ default: () => null }))
vi.mock('@/features/chat/TopicSidebar', () => ({ default: () => null }))
vi.mock('@/features/chat/WideScreenContainer', () => ({
  CONVERSATION_MAX_WIDTH: 960,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: unknown) => unknown) =>
    selector({
      paramsByAgent: {},
      searchModeByAgent: { agt_inbox: mocks.searchMode },
      wideScreen: false,
      setParams: vi.fn(),
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

import ChatPage from '@/features/chat/ChatPage'

const createdTopic = {
  agentId: 'agt_inbox',
  createdAt: 1,
  favorite: false,
  id: 'topic-new',
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
    mocks.fetchMessages.mockReset().mockReturnValue(new Promise(() => {}))
    mocks.fetchTopics.mockReset().mockResolvedValue([])
    mocks.fetchAgents.mockReset()
    mocks.sendMessage.mockClear()
    mocks.clearChatError.mockClear()
    mocks.chatError = undefined
    mocks.searchMode = 'off'
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
