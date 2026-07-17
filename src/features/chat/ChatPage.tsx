'use client'

import { useChat } from '@ai-sdk/react'
import { Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useRouter, useSearchParams } from '@/utils/navigation'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import {
  createTopic,
  deleteTopic,
  fetchMessages,
  fetchTopics,
  putMessages,
  renameTopic,
} from '@/features/chat/chatApi'
import {
  claimPendingChatText,
  claimPendingTopicSend,
  finishPendingChatText,
  finishPendingTopicSend,
  setPendingTopicSend,
  truncateTitle,
} from '@/features/chat/chatLocalStorage'
import ChatInput from '@/features/chat/ChatInput'
import ChatLayout from '@/features/chat/ChatLayout'
import ChatMessages from '@/features/chat/ChatMessages'
import ParamsPanel from '@/features/chat/ParamsPanel'
import TopicSidebar from '@/features/chat/TopicSidebar'
import WideScreenContainer from '@/features/chat/WideScreenContainer'
import { withMessageText } from '@/features/chat/messageText'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { DEFAULT_CHAT_LLM_PARAMS, type ChatLlmParams, type LocalChatTopic } from '@/features/chat/types'
import { fetchAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { isSettingsProviderId } from '@/features/settings/provider/const'
import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'

const subscribeNoop = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false
const EMPTY_MESSAGES: UIMessage[] = []
const DRAFT_TOPIC_TITLE = '新话题'

const buildChatHref = (agentId: string, topicId?: string | null) => {
  const params = new URLSearchParams({ agent: agentId })
  if (topicId) params.set('topic', topicId)
  return `/chat?${params.toString()}`
}

const styles = createStaticStyles(({ css }) => ({
  error: css`
    padding: 8px 12px;
    border-radius: 8px;
    background: ${cssVar.colorErrorBg};
    color: ${cssVar.colorError};
    font-size: 13px;
  `,
  page: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding-block: 16px 24px;
  `,
  shell: css`
    width: 100%;
    height: 100%;
  `,
}))

const chatTransport = new DefaultChatTransport({
  api: '/api/chat',
  credentials: 'include',
  headers: (): Record<string, string> => {
    const provider = useHomeStore.getState().selectedProvider
    if (!isSettingsProviderId(provider)) return {}

    const apiKey = useProviderConfigStore.getState().configs[provider].apiKey.trim()
    if (!apiKey) return {}

    return { Authorization: `Bearer ${apiKey}` }
  },
})

interface ChatViewProps {
  agentId: string
  topicId: string | null
  initialMessages: UIMessage[]
  onTopicsRefresh: () => void
}

const ChatView = memo<ChatViewProps>(({ agentId, topicId, initialMessages, onTopicsRefresh }) => {
  const router = useRouter()
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const activeAgent = useHomeStore((s) => s.activeAgent)
  const providerBaseURL = useProviderConfigStore((s) =>
    isSettingsProviderId(selectedProvider)
      ? s.configs[selectedProvider].baseURL.trim()
      : '',
  )

  const chatId = `purechat-${agentId}-${topicId ?? 'draft'}`

  const { messages, sendMessage, setMessages, status, error, clearError, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    // Throttle UI updates so Markdown/Streamdown isn't re-rendered on every chunk
    throttle: 50,
    transport: chatTransport,
  })

  // Keep a ref so edit callbacks and unmount PUT flush see the latest messages
  // even if the syncing effect has not run yet. Sync in layout effect — React
  // forbids writing refs during render (React Compiler / Strict).
  const messagesRef = useRef(messages)
  useLayoutEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const isBusy = status === 'submitted' || status === 'streaming'
  const isStreaming = status === 'streaming'

  // Debounce PUT /api/chat/topics/[id]/messages while streaming — syncing on every
  // token blocks the main thread and makes the bubble look like it isn't streaming.
  // Only persists when a topic has been solidified (topicId !== null).
  // Skip the first run after mount so an empty handoff mount cannot race a PUT []
  // past a later PUT that already saved the first user message.
  const putControllerRef = useRef<AbortController | null>(null)
  const skipInitialPutRef = useRef(true)

  const persistMessages = useCallback(
    (body: UIMessage[], signal?: AbortSignal) => {
      if (!topicId) return
      putMessages(topicId, body, signal ? { signal } : undefined).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('[chat] putMessages failed', error)
      })
    },
    [topicId],
  )

  useEffect(() => {
    if (!topicId) return

    if (skipInitialPutRef.current) {
      skipInitialPutRef.current = false
      return
    }

    const fire = () => {
      putControllerRef.current?.abort()
      const controller = new AbortController()
      putControllerRef.current = controller
      persistMessages(messages, controller.signal)
    }

    if (isBusy) {
      const timer = window.setTimeout(fire, 400)
      return () => window.clearTimeout(timer)
    }
    fire()
  }, [isBusy, messages, persistMessages, topicId])

  // Flush latest messages on unmount (topic switch / navigate away) so a cancelled
  // debounce window does not drop the tail of a stream. Skip empty snapshots to avoid
  // Strict Mode / pre-handoff unmount racing a PUT [] past a later real save.
  useEffect(() => {
    if (!topicId) return
    return () => {
      putControllerRef.current?.abort()
      if (messagesRef.current.length === 0) return
      persistMessages(messagesRef.current)
    }
  }, [persistMessages, topicId])

  const requestBody = useMemo(
    () => ({
      model: selectedModel,
      provider: selectedProvider,
      ...(providerBaseURL ? { baseURL: providerBaseURL } : {}),
      ...(activeAgent?.systemRole ? { system: activeAgent.systemRole } : {}),
    }),
    [activeAgent, providerBaseURL, selectedModel, selectedProvider],
  )

  const sendWithBody = useCallback(
    async (text: string) => {
      clearError()
      await sendMessage(
        { text },
        {
          body: requestBody,
        },
      )
      // replaceAll (PUT) bumps topic.updatedAt server-side; refresh sidebar order.
      onTopicsRefresh()
    },
    [clearError, onTopicsRefresh, requestBody, sendMessage],
  )

  const sendOrSolidify = useCallback(
    async (text: string) => {
      if (!topicId) {
        try {
          const topic = await createTopic(agentId, truncateTitle(text))
          onTopicsRefresh()
          setPendingTopicSend(text)
          // Must go through the SPA router — raw history.replaceState does not
          // update react-router useSearchParams, so ChatView would never remount.
          router.replace(buildChatHref(agentId, topic.id))
        } catch (error) {
          console.error('[chat] createTopic failed', error)
        }
        return
      }

      await sendWithBody(text)
    },
    [agentId, onTopicsRefresh, router, sendWithBody, topicId],
  )

  const handleSend = useCallback(
    async (text: string) => {
      if (isBusy) return
      await sendOrSolidify(text)
    },
    [isBusy, sendOrSolidify],
  )

  // Mount-only handoff. Do NOT depend on sendWithBody/sendOrSolidify — their
  // identity churn during streaming would re-fire sendMessage repeatedly.
  const sendWithBodyRef = useRef(sendWithBody)
  const sendOrSolidifyRef = useRef(sendOrSolidify)
  useLayoutEffect(() => {
    sendWithBodyRef.current = sendWithBody
    sendOrSolidifyRef.current = sendOrSolidify
  }, [sendOrSolidify, sendWithBody])
  const handoffStartedRef = useRef(false)

  useEffect(() => {
    if (handoffStartedRef.current) return
    handoffStartedRef.current = true

    const pendingTopic = claimPendingTopicSend()
    if (pendingTopic) {
      sendWithBodyRef.current(pendingTopic).finally(() => {
        finishPendingTopicSend()
      })
      return
    }

    const pending = claimPendingChatText()
    if (!pending) return

    sendOrSolidifyRef.current(pending).finally(() => {
      finishPendingChatText(pending)
    })
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((message) => message.id !== id))
    },
    [setMessages],
  )

  const handleEdit = useCallback(
    async (id: string, text: string) => {
      const target = messagesRef.current.find((message) => message.id === id)
      if (!target) return

      clearError()

      if (target.role === 'user') {
        // Replace the user message and regenerate the assistant reply.
        await sendMessage(
          { text, messageId: id },
          {
            body: requestBody,
          },
        )
        onTopicsRefresh()
        return
      }

      setMessages((prev) =>
        prev.map((message) => (message.id === id ? withMessageText(message, text) : message)),
      )
    },
    [clearError, onTopicsRefresh, requestBody, sendMessage, setMessages],
  )

  const handleStop = useCallback(() => {
    stop()
  }, [stop])

  return (
    <WideScreenContainer>
      <Flexbox className={styles.page} gap={16}>
        <ChatMessages
          disabled={isBusy}
          isStreaming={isStreaming}
          messages={messages}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
        {error ? (
          <Text className={styles.error}>{error.message || '发送失败，请稍后重试'}</Text>
        ) : null}
        <ChatInput isBusy={isBusy} onSend={handleSend} onStop={handleStop} />
      </Flexbox>
    </WideScreenContainer>
  )
})

ChatView.displayName = 'ChatView'

const ChatPage = memo(() => {
  // Defer searchParams reads until after hydration to avoid SSR mismatch.
  const isClient = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot)
  const router = useRouter()
  const searchParams = useSearchParams()

  const agentFromQuery = searchParams.get('agent')
  const topicFromQuery = searchParams.get('topic')
  const activeTopicId = topicFromQuery

  /** SPA: update react-router searchParams. Next shim / App Router: soft navigate. */
  const pushChatHref = useCallback(
    (nextAgentId: string, topicId?: string | null) => {
      router.push(buildChatHref(nextAgentId, topicId))
    },
    [router],
  )

  const activeAgent = useHomeStore((s) => s.activeAgent)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)

  const agentId = agentFromQuery ?? activeAgent?.identifier ?? selectedAgentId ?? PURE_AI_AGENT_ID

  const upsertLocalAgent = useAgentsStore((s) => s.upsertLocal)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)

  const paramsByAgent = useChatUiStore((s) => s.paramsByAgent)
  const setParams = useChatUiStore((s) => s.setParams)
  const params: ChatLlmParams = paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS

  const [topics, setTopics] = useState<LocalChatTopic[]>([])
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>(EMPTY_MESSAGES)
  // Tracks which topicId the currently-loaded initialMessages belong to.
  // undefined = not yet loaded; null = draft (empty); string = that topic's messages.
  const [loadedTopicId, setLoadedTopicId] = useState<string | null | undefined>(undefined)

  const refreshTopics = useCallback(async () => {
    if (!agentId) return
    try {
      const items = await fetchTopics(agentId)
      setTopics(items)
    } catch (error) {
      console.error('[chat] refreshTopics failed', error)
    }
  }, [agentId])

  // Deep-link / refresh: sync `?agent=` into home store from API.
  useEffect(() => {
    if (!agentFromQuery) return
    if (activeAgent?.identifier === agentFromQuery) return

    let cancelled = false
    ;(async () => {
      try {
        const agent = await fetchAgent(agentFromQuery)
        if (cancelled) return
        upsertLocalAgent(agent)
        setSelectedAgentId(agent.id)
        setActiveAgent({
          avatar: agent.avatar,
          identifier: agent.id,
          systemRole: agent.systemRole,
          title: agent.title,
        })
      } catch (error) {
        console.error('[chat] fetchAgent failed', error)
        if (cancelled) return
        const fallback = DEFAULT_PURE_AI_META
        setSelectedAgentId(fallback.id)
        setActiveAgent({
          avatar: fallback.avatar,
          identifier: fallback.id,
          systemRole: fallback.systemRole,
          title: fallback.title,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeAgent?.identifier, agentFromQuery, setActiveAgent, setSelectedAgentId, upsertLocalAgent])

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  // Fetch topic list whenever agentId changes (client-only; server renders []).
  // setState lives in the async continuation so the effect body stays free of
  // synchronous setState calls.
  useEffect(() => {
    if (!isClient || !agentId) return

    let cancelled = false
    fetchTopics(agentId)
      .then((items) => {
        if (!cancelled) setTopics(items)
      })
      .catch((error) => {
        console.error('[chat] refreshTopics failed', error)
      })

    return () => {
      cancelled = true
    }
  }, [agentId, isClient])

  // Fetch messages for the active topic. Draft (activeTopicId === null) is ready
  // immediately; invalidate loadedTopicId so returning to a prior topic always refetches
  // (avoids mounting ChatView with stale parent initialMessages after a draft visit).
  useEffect(() => {
    if (!isClient) return

    if (activeTopicId === null) {
      setInitialMessages(EMPTY_MESSAGES)
      setLoadedTopicId(null)
      return
    }

    let cancelled = false
    setLoadedTopicId(undefined)

    fetchMessages(activeTopicId)
      .then((msgs) => {
        if (cancelled) return
        setInitialMessages(msgs)
        setLoadedTopicId(activeTopicId)
      })
      .catch((error) => {
        console.error('[chat] fetchMessages failed', error)
        // Do NOT mark ready with [] — ChatView would mount and risk PUT replaceAll wipe.
      })

    return () => {
      cancelled = true
    }
  }, [activeTopicId, isClient])

  const handleNewTopic = useCallback(() => {
    // Already on draft for this agent — no-op.
    if (activeTopicId === null) return
    pushChatHref(agentId)
  }, [activeTopicId, agentId, pushChatHref])

  const handleSelectTopic = useCallback(
    (id: string) => {
      if (id === activeTopicId) return
      pushChatHref(agentId, id)
    },
    [activeTopicId, agentId, pushChatHref],
  )

  const handleRenameTopic = useCallback(async (id: string, title: string) => {
    try {
      const updated = await renameTopic(id, title)
      setTopics((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (error) {
      console.error('[chat] renameTopic failed', error)
    }
  }, [])

  const handleDeleteTopic = useCallback(
    async (id: string) => {
      try {
        await deleteTopic(id)
        setTopics((prev) => prev.filter((t) => t.id !== id))
        // Deleting the active topic falls back to the draft view for this agent.
        if (id === activeTopicId) {
          pushChatHref(agentId)
        }
      } catch (error) {
        console.error('[chat] deleteTopic failed', error)
      }
    },
    [activeTopicId, agentId, pushChatHref],
  )

  const handleParamsChange = useCallback(
    (patch: Partial<ChatLlmParams>) => {
      setParams(agentId, patch)
    },
    [agentId, setParams],
  )

  const handleTopicsRefresh = useCallback(() => {
    refreshTopics()
  }, [refreshTopics])

  const messagesReady = activeTopicId === null ? true : loadedTopicId === activeTopicId
  const showShell = !isClient || !messagesReady

  const topicTitle = useMemo(() => {
    if (!activeTopicId) return DRAFT_TOPIC_TITLE
    return topics.find((topic) => topic.id === activeTopicId)?.title ?? DRAFT_TOPIC_TITLE
  }, [activeTopicId, topics])

  return (
    <ChatLayout
      left={
        <TopicSidebar
          activeTopicId={activeTopicId}
          topics={topics}
          onNewTopic={handleNewTopic}
          onSelectTopic={handleSelectTopic}
          onRenameTopic={handleRenameTopic}
          onDeleteTopic={handleDeleteTopic}
        />
      }
      right={<ParamsPanel value={params} onChange={handleParamsChange} />}
      title={topicTitle}
    >
      {showShell ? (
        <div className={styles.shell} />
      ) : (
        <ChatView
          key={`${agentId}:${activeTopicId ?? 'draft'}`}
          agentId={agentId}
          initialMessages={activeTopicId === null ? EMPTY_MESSAGES : initialMessages}
          topicId={activeTopicId}
          onTopicsRefresh={handleTopicsRefresh}
        />
      )}
    </ChatLayout>
  )
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
