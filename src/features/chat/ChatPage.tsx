'use client'

import { Flexbox } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import type { UIMessage } from 'ai'
import { useRouter, useSearchParams } from '@/utils/navigation'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DEFAULT_CHAT_PERMISSION_MODE } from '@pure/types'
import type { ChatPermissionMode } from '@pure/types'

import { useApp } from '@/components/AntdStaticMethods'
import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import { buildChatHref } from '@/features/chat/buildChatHref'
import {
  autoRenameTopic,
  deleteTopic,
  deleteTopics as deleteTopicsApi,
  fetchMessages,
  fetchTopics,
  putMessages,
  updateTopic,
} from '@/features/chat/chatApi'
import ChatInput from '@/features/chat/ChatInput'
import ChatLayout from '@/features/chat/ChatLayout'
import { getPendingChatPermissionMode } from '@/features/chat/chatLocalStorage'
import ChatMessagesSkeleton from '@/features/chat/ChatMessagesSkeleton'
import type { ChatViewActions } from '@/features/chat/ChatView'
import ChatView from '@/features/chat/ChatView'
import ParamsPanel from '@/features/chat/ParamsPanel'
import TopicSidebar from '@/features/chat/TopicSidebar'
import WideScreenContainer from '@/features/chat/WideScreenContainer'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { DEFAULT_CHAT_LLM_PARAMS } from '@/features/chat/types'
import type {
  ChatLlmParams,
  ChatSearchMode,
  LocalChatTopic,
  TopicDeleteScope,
  TopicUpdate,
} from '@/features/chat/types'
import { fetchAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { isSettingsProviderId } from '@/features/settings/provider/const'
import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'
import { getDesktopApi } from '@/types/desktop'

const subscribeNoop = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false
const EMPTY_MESSAGES: UIMessage[] = []
const DRAFT_TOPIC_TITLE = '新话题'

const styles = createStaticStyles(({ css }) => ({
  page: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding-block-end: 8px;
  `,
  shell: css`
    width: 100%;
    height: 100%;
  `,
}))

const ChatPage = memo(() => {
  // Defer searchParams reads until after hydration to avoid SSR mismatch.
  const isClient = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { message } = useApp()

  const agentFromQuery = searchParams.get('agent')
  const topicFromQuery = searchParams.get('topic')
  const activeTopicId = topicFromQuery

  /** SPA: update react-router searchParams. Next shim / App Router: soft navigate. */
  const pushChatHref = useCallback(
    (nextAgentId: string, topicId?: string | null) => {
      router.push(buildChatHref(nextAgentId, topicId))
    },
    [router]
  )

  const activeAgent = useHomeStore((s) => s.activeAgent)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const providerConfig = useProviderConfigStore((s) =>
    isSettingsProviderId(selectedProvider) ? s.configs[selectedProvider] : undefined
  )

  const agentId = agentFromQuery ?? activeAgent?.identifier ?? selectedAgentId ?? PURE_AI_AGENT_ID

  const upsertLocalAgent = useAgentsStore((s) => s.upsertLocal)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)
  const agents = useAgentsStore((s) => s.agents)

  const paramsByAgent = useChatUiStore((s) => s.paramsByAgent)
  const searchMode = useChatUiStore((s) => s.searchModeByAgent[agentId] ?? 'off')
  const setParams = useChatUiStore((s) => s.setParams)
  const setSearchMode = useChatUiStore((s) => s.setSearchMode)
  const params: ChatLlmParams = paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS

  const [topics, setTopics] = useState<LocalChatTopic[]>([])
  const [draftPermissionMode, setDraftPermissionMode] = useState<ChatPermissionMode>(() =>
    typeof window === 'undefined' ? DEFAULT_CHAT_PERMISSION_MODE : getPendingChatPermissionMode()
  )
  const [topicsLoadedAgentId, setTopicsLoadedAgentId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>(EMPTY_MESSAGES)
  // Tracks which topicId the currently-loaded initialMessages belong to.
  // undefined = not yet loaded; null = draft (empty); string = that topic's messages.
  const [loadedTopicId, setLoadedTopicId] = useState<string | null | undefined>(() =>
    isClient && activeTopicId === null ? null : undefined
  )
  const [messagesTopicKey, setMessagesTopicKey] = useState<string | null | undefined>(() =>
    isClient ? activeTopicId : undefined
  )
  const [isBusy, setIsBusy] = useState(false)
  const [autoRenamingTopicId, setAutoRenamingTopicId] = useState<string | null>(null)
  // Per-topic message cache. Lets topic switches
  // paint immediately instead of blanking the shell while fetchMessages resolves.
  const [messagesCache, setMessagesCache] = useState(() => new Map<string, UIMessage[]>())
  const autoRenamingTopicIdRef = useRef<string | null>(null)
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

  const handleInputSend = useCallback(async (text: string, files: File[]) => {
    await chatActionsRef.current.send(text, files)
  }, [])

  const handleInputStop = useCallback(() => {
    chatActionsRef.current.stop()
  }, [])

  const refreshTopics = useCallback(async () => {
    if (!agentId) return
    try {
      const items = await fetchTopics(agentId)
      setTopics(items)
      setTopicsLoadedAgentId(agentId)
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
        if (!cancelled) setTopics([])
      })
      .finally(() => {
        if (!cancelled) setTopicsLoadedAgentId(agentId)
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
    setDraftPermissionMode(DEFAULT_CHAT_PERMISSION_MODE)
    pushChatHref(agentId)
  }, [activeTopicId, agentId, pushChatHref])

  const handleAgentSelect = useCallback(
    (agent: AgentListItem) => {
      setSelectedAgentId(agent.id)
      setActiveAgent({
        avatar: agent.avatar,
        identifier: agent.id,
        systemRole: agent.systemRole,
        title: agent.title,
      })
      if (agent.id === agentId && activeTopicId === null) return
      setDraftPermissionMode(DEFAULT_CHAT_PERMISSION_MODE)
      if (agent.id !== agentId) {
        setTopics([])
        setTopicsLoadedAgentId(null)
      }
      pushChatHref(agent.id)
    },
    [activeTopicId, agentId, pushChatHref, setActiveAgent, setSelectedAgentId]
  )

  const handleSelectTopic = useCallback(
    (id: string) => {
      if (id === activeTopicId) return
      pushChatHref(agentId, id)
    },
    [activeTopicId, agentId, pushChatHref]
  )

  const handleUpdateTopic = useCallback(
    async (id: string, patch: TopicUpdate, errorText: string) => {
      try {
        const updated = await updateTopic(id, patch)
        setTopics((prev) => prev.map((topic) => (topic.id === id ? updated : topic)))
      } catch (error) {
        console.error('[chat] updateTopic failed', error)
        message.error(errorText)
      }
    },
    [message]
  )

  const handleRenameTopic = useCallback(
    (id: string, title: string) => handleUpdateTopic(id, { title }, '重命名失败'),
    [handleUpdateTopic]
  )

  const handleFavoriteTopic = useCallback(
    (id: string, favorite: boolean) => handleUpdateTopic(id, { favorite }, favorite ? '收藏失败' : '取消收藏失败'),
    [handleUpdateTopic]
  )

  const handleAutoRenameTopic = useCallback(
    async (id: string) => {
      if (isBusy || autoRenamingTopicIdRef.current) return

      autoRenamingTopicIdRef.current = id
      setAutoRenamingTopicId(id)
      try {
        const cachedMessages = messagesCache.get(id)
        if (cachedMessages) await putMessages(id, cachedMessages)

        const updated = await autoRenameTopic(id, {
          ...(selectedProvider !== 'purechat' && providerConfig?.apiKey ? { apiKey: providerConfig.apiKey } : {}),
          ...(selectedProvider !== 'purechat' && providerConfig?.baseURL ? { baseURL: providerConfig.baseURL } : {}),
          model: selectedModel,
          provider: selectedProvider,
        })
        setTopics((prev) => prev.map((topic) => (topic.id === id ? updated : topic)))
        message.success('已智能重命名')
      } catch (error) {
        console.error('[chat] auto rename topic failed', error)
        message.error('智能重命名失败')
      } finally {
        if (autoRenamingTopicIdRef.current === id) autoRenamingTopicIdRef.current = null
        setAutoRenamingTopicId((currentId) => (currentId === id ? null : currentId))
      }
    },
    [isBusy, message, messagesCache, providerConfig, selectedModel, selectedProvider]
  )

  const handleProjectChange = useCallback(
    (id: string, projectName: string | null) => handleUpdateTopic(id, { projectName }, '移动到项目失败'),
    [handleUpdateTopic]
  )

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
    [activeTopicId, agentId, pushChatHref]
  )

  const handleDeleteTopics = useCallback(
    async (scope: TopicDeleteScope) => {
      try {
        const deletedIds = await deleteTopicsApi(agentId, scope)
        const deleted = new Set(deletedIds)
        setMessagesCache((prev) => {
          if (deleted.size === 0) return prev
          const next = new Map(prev)
          for (const id of deleted) next.delete(id)
          return next
        })
        setTopics((prev) => prev.filter((topic) => !deleted.has(topic.id)))
        if (activeTopicId && deleted.has(activeTopicId)) pushChatHref(agentId)
        message.success(`已删除 ${deletedIds.length} 个话题`)
      } catch (error) {
        console.error('[chat] deleteTopics failed', error)
        message.error('批量删除话题失败')
        throw error
      }
    },
    [activeTopicId, agentId, message, pushChatHref]
  )

  const handleParamsChange = useCallback(
    (patch: Partial<ChatLlmParams>) => {
      setParams(agentId, patch)
    },
    [agentId, setParams]
  )

  const handleSearchModeChange = useCallback(
    (mode: ChatSearchMode) => {
      setSearchMode(agentId, mode)
    },
    [agentId, setSearchMode]
  )

  const handlePermissionModeChange = useCallback(
    async (mode: ChatPermissionMode) => {
      if (mode === 'full') {
        const result = await getDesktopApi()?.requestFullAccess(activeTopicId ?? 'draft')
        if (result && !result.granted) throw new Error('完全访问权限未确认')
      }
      if (!activeTopicId) {
        setDraftPermissionMode(mode)
        return
      }

      try {
        const updated = await updateTopic(activeTopicId, { permissionMode: mode })
        setTopics((previous) => previous.map((topic) => (topic.id === activeTopicId ? updated : topic)))
      } catch (error) {
        console.error('[chat] update permission mode failed', error)
        message.error('权限模式保存失败')
        throw error
      }
    },
    [activeTopicId, message]
  )

  const handleTopicsRefresh = useCallback(() => {
    refreshTopics()
  }, [refreshTopics])

  const messagesReady = activeTopicId === null ? true : loadedTopicId === activeTopicId
  const inputBusy = isBusy || !messagesReady
  const topicsLoading = topicsLoadedAgentId !== agentId

  const topicTitle = useMemo(() => {
    if (!activeTopicId) return DRAFT_TOPIC_TITLE
    return topics.find((topic) => topic.id === activeTopicId)?.title ?? DRAFT_TOPIC_TITLE
  }, [activeTopicId, topics])
  const activeTopic = useMemo(
    () => (activeTopicId ? (topics.find((topic) => topic.id === activeTopicId) ?? null) : null),
    [activeTopicId, topics]
  )
  const isDesktop = isClient && Boolean(getDesktopApi())
  const permissionMode = activeTopic?.permissionMode ?? draftPermissionMode

  return (
    <ChatLayout
      busy={isBusy}
      left={
        <TopicSidebar
          activeTopicId={activeTopicId}
          agents={agents}
          autoRenameDisabled={isBusy || autoRenamingTopicId !== null}
          autoRenamingTopicId={autoRenamingTopicId}
          currentAgentId={agentId}
          loading={topicsLoading}
          topics={topics}
          onAgentSelect={handleAgentSelect}
          onAutoRenameTopic={handleAutoRenameTopic}
          onFavoriteTopic={handleFavoriteTopic}
          onNewTopic={handleNewTopic}
          onProjectChange={handleProjectChange}
          onSelectTopic={handleSelectTopic}
          onRenameTopic={handleRenameTopic}
          onDeleteTopic={handleDeleteTopic}
          onDeleteTopics={handleDeleteTopics}
        />
      }
      topic={activeTopic}
      right={<ParamsPanel value={params} onChange={handleParamsChange} />}
      title={topicTitle}
      autoRenamingTopicId={autoRenamingTopicId}
      onAutoRenameTopic={handleAutoRenameTopic}
      onDeleteTopic={handleDeleteTopic}
      onFavoriteTopic={handleFavoriteTopic}
      onRenameTopic={handleRenameTopic}
    >
      {!isClient ? (
        <div className={styles.shell} />
      ) : (
        <Flexbox className={styles.page}>
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
              permissionMode={isDesktop ? permissionMode : undefined}
              searchMode={searchMode}
            />
          ) : (
            <WideScreenContainer>
              <ChatMessagesSkeleton />
            </WideScreenContainer>
          )}
          <WideScreenContainer fill={false}>
            <ChatInput
              isBusy={inputBusy}
              permissionMode={isDesktop ? permissionMode : undefined}
              searchMode={searchMode}
              topicId={activeTopicId}
              onPermissionModeChange={isDesktop ? handlePermissionModeChange : undefined}
              onSearchModeChange={handleSearchModeChange}
              onSend={handleInputSend}
              onStop={handleInputStop}
            />
          </WideScreenContainer>
        </Flexbox>
      )}
    </ChatLayout>
  )
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
