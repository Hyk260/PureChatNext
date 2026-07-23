'use client'

import { Flex, Typography } from 'antd'
import { useChat } from '@ai-sdk/react'
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
import ChatMessagesSkeleton from '@/features/chat/ChatMessagesSkeleton'
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

/** Stable content fingerprint so hydrate / Strict Mode remounts do not re-PUT identical snapshots. */
const messagesSignature = (messages: UIMessage[]) =>
  JSON.stringify(
    messages.map((message) => ({
      id: message.id,
      parts: message.parts,
      role: message.role,
    })),
  )

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

    const apiKey = useProviderConfigStore.getState().configs[provider]?.apiKey.trim() ?? ''
    if (!apiKey) return {}

    return { Authorization: `Bearer ${apiKey}` }
  },
})

type ChatViewActions = {
  send: (text: string) => void | Promise<void>
  stop: () => void
}

interface ChatViewProps {
  agentId: string
  topicId: string | null
  initialMessages: UIMessage[]
  onBusyChange: (busy: boolean) => void
  onCacheMessages: (topicId: string, messages: UIMessage[]) => void
  onBindActions: (actions: ChatViewActions) => void
  onTopicsRefresh: () => void
}

const ChatView = memo<ChatViewProps>(({
  agentId,
  topicId,
  initialMessages,
  onBusyChange,
  onCacheMessages,
  onBindActions,
  onTopicsRefresh,
}) => {
  const router = useRouter()
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const activeAgent = useHomeStore((s) => s.activeAgent)
  const providerBaseURL = useProviderConfigStore((s) =>
    isSettingsProviderId(selectedProvider)
      ? (s.configs[selectedProvider]?.baseURL.trim() ?? '')
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

  useLayoutEffect(() => {
    onBusyChange(isBusy)
    return () => onBusyChange(false)
  }, [isBusy, onBusyChange])

  // Debounce PUT /api/chat/topics/[id]/messages while streaming — syncing on every
  // token blocks the main thread and makes the bubble look like it isn't streaming.
  // Only persists when a topic has been solidified (topicId !== null).
  // Skip the first run after mount so an empty handoff mount cannot race a PUT []
  // past a later PUT that already saved the first user message.
  const putControllerRef = useRef<AbortController | null>(null)
  const skipInitialPutRef = useRef(true)
  const lastPutSigRef = useRef(messagesSignature(initialMessages))
  // Survives Strict Mode remount (same fiber); cancelled if setup runs again.
  const flushTimerRef = useRef<number | null>(null)

  const persistMessages = useCallback(
    (body: UIMessage[], signal?: AbortSignal) => {
      if (!topicId) return
      const signature = messagesSignature(body)
      if (signature === lastPutSigRef.current) return
      lastPutSigRef.current = signature
      putMessages(topicId, body, signal ? { signal } : undefined).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (error instanceof Error && error.name === 'AbortError') return
        // Allow a later retry with the same snapshot after a failed PUT.
        if (lastPutSigRef.current === signature) lastPutSigRef.current = ''
        console.error('[chat] putMessages failed', error)
      })
    },
    [topicId],
  )

  useEffect(() => {
    if (!topicId) return

    if (skipInitialPutRef.current) {
      skipInitialPutRef.current = false
      // Align fingerprint with whatever useChat hydrated — do not PUT on open.
      lastPutSigRef.current = messagesSignature(messages)
      return
    }

    const fire = () => {
      putControllerRef.current?.abort()
      const controller = new AbortController()
      putControllerRef.current = controller
      persistMessages(messages, controller.signal)
      // Write-through only when idle — avoids parent re-renders on every stream tick.
      if (!isBusy) onCacheMessages(topicId, messages)
    }

    if (isBusy) {
      const timer = window.setTimeout(fire, 400)
      return () => window.clearTimeout(timer)
    }
    fire()
  }, [isBusy, messages, onCacheMessages, persistMessages, topicId])

  // Flush latest messages on real unmount (topic switch / navigate away).
  // Strict Mode runs cleanup→setup on the same fiber; delay the PUT and cancel it
  // if we remount, otherwise a single topic open would PUT 2–3 times by itself.
  useEffect(() => {
    if (!topicId) return

    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }

    return () => {
      putControllerRef.current?.abort()
      const snapshot = messagesRef.current
      const id = topicId
      if (snapshot.length === 0) return

      onCacheMessages(id, snapshot)
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null
        const signature = messagesSignature(snapshot)
        if (signature === lastPutSigRef.current) return
        lastPutSigRef.current = signature
        putMessages(id, snapshot).catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof Error && error.name === 'AbortError') return
          if (lastPutSigRef.current === signature) lastPutSigRef.current = ''
          console.error('[chat] putMessages failed', error)
        })
      }, 0)
    }
  }, [onCacheMessages, topicId])

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

  useLayoutEffect(() => {
    onBindActions({ send: handleSend, stop: handleStop })
  }, [handleSend, handleStop, onBindActions])

  return (
    <>
      <ChatMessages
        disabled={isBusy}
        isStreaming={isStreaming}
        messages={messages}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      {error ? (
        <Typography.Text className={styles.error}>{error.message || '发送失败，请稍后重试'}</Typography.Text>
      ) : null}
    </>
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
  const [loadedTopicId, setLoadedTopicId] = useState<string | null | undefined>(() =>
    isClient && activeTopicId === null ? null : undefined,
  )
  const [messagesTopicKey, setMessagesTopicKey] = useState<string | null | undefined>(
    () => (isClient ? activeTopicId : undefined),
  )
  const [isBusy, setIsBusy] = useState(false)
  // Per-topic message cache. Lets topic switches
  // paint immediately instead of blanking the shell while fetchMessages resolves.
  const [messagesCache, setMessagesCache] = useState(() => new Map<string, UIMessage[]>())
  const chatActionsRef = useRef<ChatViewActions>({
    send: async () => {},
    stop: () => {},
  })

  // Sync draft/cache seed when the active topic changes (React "adjust state on
  // props change" pattern — avoids an effect that setStates synchronously).
  if (isClient && activeTopicId !== messagesTopicKey) {
    setMessagesTopicKey(activeTopicId)
    if (activeTopicId === null) {
      setInitialMessages(EMPTY_MESSAGES)
      setLoadedTopicId(null)
    } else {
      const cached = messagesCache.get(activeTopicId)
      if (cached) {
        setInitialMessages(cached)
        setLoadedTopicId(activeTopicId)
      } else {
        setLoadedTopicId(undefined)
      }
    }
  }

  const handleCacheMessages = useCallback((id: string, messages: UIMessage[]) => {
    setMessagesCache((prev) => {
      const next = new Map(prev)
      next.set(id, messages)
      return next
    })
  }, [])

  const handleBindActions = useCallback((actions: ChatViewActions) => {
    chatActionsRef.current = actions
  }, [])

  const handleBusyChange = useCallback((busy: boolean) => {
    setIsBusy(busy)
  }, [])

  const handleInputSend = useCallback(async (text: string) => {
    await chatActionsRef.current.send(text)
  }, [])

  const handleInputStop = useCallback(() => {
    chatActionsRef.current.stop()
  }, [])

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

  // Soft-refresh messages for the active topic. Cache-first paint happens above
  // during render; this effect only hits the network.
  //
  // Once this topic is already on screen, do NOT push GET results into
  // `initialMessages` — a late/stale response would remount-seed older history.
  // Live ChatView owns the message list; unmount write-through keeps the cache warm.
  const loadedTopicIdRef = useRef(loadedTopicId)
  useLayoutEffect(() => {
    loadedTopicIdRef.current = loadedTopicId
  }, [loadedTopicId])

  useEffect(() => {
    if (!isClient || activeTopicId === null) return

    let cancelled = false

    fetchMessages(activeTopicId)
      .then((msgs) => {
        if (cancelled) return

        setMessagesCache((prev) => {
          const existing = prev.get(activeTopicId)
          // Prefer a longer local snapshot (post-send write-through) over a GET
          // that raced ahead of the in-flight PUT.
          if (existing && existing.length > msgs.length) return prev
          const next = new Map(prev)
          next.set(activeTopicId, msgs)
          return next
        })

        if (loadedTopicIdRef.current === activeTopicId) return

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
        setMessagesCache((prev) => {
          if (!prev.has(id)) return prev
          const next = new Map(prev)
          next.delete(id)
          return next
        })
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
  const inputBusy = isBusy || !messagesReady

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
      {!isClient ? (
        <div className={styles.shell} />
      ) : (
        <WideScreenContainer>
          <Flex vertical className={styles.page} gap={16}>
            {messagesReady ? (
              <ChatView
                key={`${agentId}:${activeTopicId ?? 'draft'}`}
                agentId={agentId}
                initialMessages={activeTopicId === null ? EMPTY_MESSAGES : initialMessages}
                topicId={activeTopicId}
                onBindActions={handleBindActions}
                onBusyChange={handleBusyChange}
                onCacheMessages={handleCacheMessages}
                onTopicsRefresh={handleTopicsRefresh}
              />
            ) : (
              <ChatMessagesSkeleton />
            )}
            <ChatInput isBusy={inputBusy} onSend={handleInputSend} onStop={handleInputStop} />
          </Flex>
        </WideScreenContainer>
      )}
    </ChatLayout>
  )
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
