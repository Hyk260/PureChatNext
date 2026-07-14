'use client'

import { useChat } from '@ai-sdk/react'
import { Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useRouter, useSearchParams } from 'next/navigation'
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { findHomeAgent } from '@/const/home/agents'
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
import { withMessageText } from '@/features/chat/messageText'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { DEFAULT_CHAT_LLM_PARAMS } from '@/features/chat/types'
import type { ChatLlmParams, LocalChatTopic } from '@/features/chat/types'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const subscribeNoop = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false
const EMPTY_MESSAGES: UIMessage[] = []

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
    max-width: 720px;
    height: 100dvh;
    margin-inline: auto;
    padding: 48px 16px 24px;
  `,
}))

const chatTransport = new DefaultChatTransport({
  api: '/api/chat',
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

  const chatId = `purechat-${agentId}-${topicId ?? 'draft'}`

  const { messages, sendMessage, setMessages, status, error, clearError, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    // Throttle UI updates so Markdown/Streamdown isn't re-rendered on every chunk
    throttle: 50,
    transport: chatTransport,
  })

  // Keep a ref so edit callbacks stay stable during streaming.
  const messagesRef = useRef(messages)
  const isBusy = status === 'submitted' || status === 'streaming'
  const isStreaming = status === 'streaming'

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Debounce PUT /api/chat/topics/[id]/messages while streaming — syncing on every
  // token blocks the main thread and makes the bubble look like it isn't streaming.
  // Only persists when a topic has been solidified (topicId !== null).
  const putControllerRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!topicId) return

    const fire = () => {
      putControllerRef.current?.abort()
      const controller = new AbortController()
      putControllerRef.current = controller
      void putMessages(topicId, messages, { signal: controller.signal }).catch((error) => {
        console.error('[chat] putMessages failed', error)
      })
    }

    if (isBusy) {
      const timer = window.setTimeout(fire, 400)
      return () => window.clearTimeout(timer)
    }
    fire()
  }, [agentId, isBusy, messages, topicId])

  const requestBody = useMemo(
    () => ({
      model: selectedModel,
      provider: selectedProvider,
      ...(activeAgent?.systemRole ? { system: activeAgent.systemRole } : {}),
    }),
    [activeAgent, selectedModel, selectedProvider],
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
        const topic = await createTopic(agentId, truncateTitle(text))
        onTopicsRefresh()
        setPendingTopicSend(text)
        router.replace(
          `/chat?agent=${encodeURIComponent(agentId)}&topic=${encodeURIComponent(topic.id)}`,
        )
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
  sendWithBodyRef.current = sendWithBody
  sendOrSolidifyRef.current = sendOrSolidify
  const handoffStartedRef = useRef(false)

  useEffect(() => {
    if (handoffStartedRef.current) return
    handoffStartedRef.current = true

    const pendingTopic = claimPendingTopicSend()
    if (pendingTopic) {
      void sendWithBodyRef.current(pendingTopic).finally(() => {
        finishPendingTopicSend()
      })
      return
    }

    const pending = claimPendingChatText()
    if (!pending) return

    void sendOrSolidifyRef.current(pending).finally(() => {
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
    void stop()
  }, [stop])

  return (
    <Flexbox className={styles.page} gap={16}>
      <ChatMessages
        disabled={isBusy}
        isStreaming={isStreaming}
        messages={messages}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      {error ? <Text className={styles.error}>{error.message || '发送失败，请稍后重试'}</Text> : null}
      <ChatInput isBusy={isBusy} onSend={handleSend} onStop={handleStop} />
    </Flexbox>
  )
})

ChatView.displayName = 'ChatView'

const ChatPage = memo(() => {
  // Defer searchParams reads until after hydration to avoid SSR mismatch.
  const isClient = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot)
  const searchParams = useSearchParams()
  const router = useRouter()

  const agentFromQuery = searchParams.get('agent')
  const topicFromQuery = searchParams.get('topic')
  const activeTopicId = topicFromQuery

  const activeAgent = useHomeStore((s) => s.activeAgent)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)

  const agentId = agentFromQuery ?? activeAgent?.identifier ?? selectedAgentId

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

  // Deep-link / refresh: sync `?agent=` into home store.
  useEffect(() => {
    if (!agentFromQuery) return
    if (activeAgent?.identifier === agentFromQuery) return

    const agent = findHomeAgent(agentFromQuery)
    setSelectedAgentId(agent.id)
    setActiveAgent({
      avatar: agent.avatar,
      identifier: agent.id,
      systemRole: agent.systemRole,
      title: agent.title,
    })
  }, [activeAgent?.identifier, agentFromQuery, setActiveAgent, setSelectedAgentId])

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

  // Fetch messages for the active topic. Draft (activeTopicId === null) resolves
  // synchronously via the render branch below — no setState needed here.
  useEffect(() => {
    if (!isClient || activeTopicId === null) return

    let cancelled = false
    fetchMessages(activeTopicId)
      .then((msgs) => {
        if (cancelled) return
        setInitialMessages(msgs)
        setLoadedTopicId(activeTopicId)
      })
      .catch((error) => {
        console.error('[chat] fetchMessages failed', error)
        if (cancelled) return
        setInitialMessages(EMPTY_MESSAGES)
        setLoadedTopicId(activeTopicId)
      })

    return () => {
      cancelled = true
    }
  }, [activeTopicId, isClient])

  const handleNewTopic = useCallback(() => {
    // No draft bucket to clear — messages live on the server per topic now.
    router.push(`/chat?agent=${encodeURIComponent(agentId)}`)
  }, [agentId, router])

  const handleSelectTopic = useCallback(
    (id: string) => {
      router.push(
        `/chat?agent=${encodeURIComponent(agentId)}&topic=${encodeURIComponent(id)}`,
      )
    },
    [agentId, router],
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
          router.push(`/chat?agent=${encodeURIComponent(agentId)}`)
        }
      } catch (error) {
        console.error('[chat] deleteTopic failed', error)
      }
    },
    [activeTopicId, agentId, router],
  )

  const handleParamsChange = useCallback(
    (patch: Partial<ChatLlmParams>) => {
      setParams(agentId, patch)
    },
    [agentId, setParams],
  )

  const messagesReady = activeTopicId === null ? true : loadedTopicId === activeTopicId
  const showShell = !isClient || !messagesReady

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
    >
      {showShell ? <div className={styles.page} /> : (
        <ChatView
          key={`${agentId}:${activeTopicId ?? 'draft'}`}
          agentId={agentId}
          initialMessages={activeTopicId === null ? EMPTY_MESSAGES : initialMessages}
          topicId={activeTopicId}
          onTopicsRefresh={() => void refreshTopics()}
        />
      )}
    </ChatLayout>
  )
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
