'use client'

import { Flex } from '@pure/ui'
import { toast, createStaticStyles } from '@lobehub/ui'
import type { UIMessage } from 'ai'
import { useRouter, useSearchParams } from 'next/navigation'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ChatPermissionMode } from '@pure/types'

import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import {
  autoRenameTopic,
  buildChatHref,
  deleteTopic,
  deleteTopics as deleteTopicsApi,
  fetchMessages,
  fetchTopics,
  putMessages,
  updateTopic,
} from '@/features/chat/chatApi'
import ChatInput from '@/features/chat/ChatInput'
import ChatLayout from '@/features/chat/ChatLayout'
import { getPendingChatPermissionMode, setPendingChatProject } from '@/features/chat/chatLocalStorage'
import ChatMessagesSkeleton from '@/features/chat/ChatMessagesSkeleton'
import type { ChatViewActions } from '@/features/chat/ChatView'
import ChatView from '@/features/chat/ChatView'
import WorkPanel from '@/features/chat/WorkPanel'
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
import { toActiveCommunityAgent } from '@/features/community/toActiveCommunityAgent'
import { fetchAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
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

  const agentId = agentFromQuery ?? activeAgent?.identifier ?? selectedAgentId ?? PURE_AI_AGENT_ID

  const upsertLocalAgent = useAgentsStore((s) => s.upsertLocal)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)
  const agents = useAgentsStore((s) => s.agents)

  const paramsByAgent = useChatUiStore((s) => s.paramsByAgent)
  const permissionMode = useChatUiStore((s) => s.permissionMode)
  const permissionModeInitialized = useChatUiStore((s) => s.permissionModeInitialized)
  const searchMode = useChatUiStore((s) => s.searchMode)
  const initializePermissionMode = useChatUiStore((s) => s.initializePermissionMode)
  const setPermissionMode = useChatUiStore((s) => s.setPermissionMode)
  const setParams = useChatUiStore((s) => s.setParams)
  const setSearchMode = useChatUiStore((s) => s.setSearchMode)
  const params: ChatLlmParams = paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS

  const [topics, setTopics] = useState<LocalChatTopic[]>([])
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
  const [inputPrefill, setInputPrefill] = useState('')
  const [inputPrefillKey, setInputPrefillKey] = useState(0)
  const [autoRenamingTopicId, setAutoRenamingTopicId] = useState<string | null>(null)
  // Per-topic message cache. Lets topic switches
  // paint immediately instead of blanking the shell while fetchMessages resolves.
  const [messagesCache, setMessagesCache] = useState(() => new Map<string, UIMessage[]>())
  const autoRenamingTopicIdRef = useRef<string | null>(null)
  const chatActionsRef = useRef<ChatViewActions>({
    send: async () => {},
    stop: () => {},
  })
  const grantedFullAccessTopicsRef = useRef(new Set<string>())
  const ensureFullAccess = useCallback(async (topicId: string) => {
    if (grantedFullAccessTopicsRef.current.has(topicId)) return
    const result = await getDesktopApi()?.requestFullAccess(topicId)
    if (result && !result.granted) throw new Error('完全访问权限未确认')
    grantedFullAccessTopicsRef.current.add(topicId)
  }, [])

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

  const handleInputStop = useCallback(() => {
    chatActionsRef.current.stop()
  }, [])

  const handleSelectOpeningQuestion = useCallback((question: string) => {
    setInputPrefill(question)
    setInputPrefillKey((key) => key + 1)
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
        setActiveAgent(toActiveCommunityAgent(agent))
      } catch (error) {
        console.error('[chat] fetchAgent failed', error)
        if (cancelled) return
        const fallback = DEFAULT_PURE_AI_META
        setSelectedAgentId(fallback.id)
        setActiveAgent(toActiveCommunityAgent(fallback))
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
    pushChatHref(agentId)
  }, [activeTopicId, agentId, pushChatHref])

  const handleNewTopicInProject = useCallback(
    (projectName: string) => {
      if (activeTopicId === null) {
        setPendingChatProject({ name: projectName })
        return
      }
      setPendingChatProject({ name: projectName })
      pushChatHref(agentId)
    },
    [activeTopicId, agentId, pushChatHref]
  )

  const handleAgentSelect = useCallback(
    (agent: AgentListItem) => {
      setSelectedAgentId(agent.id)
      setActiveAgent(toActiveCommunityAgent(agent))
      if (agent.id === agentId && activeTopicId === null) return
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
        toast.error(errorText)
      }
    },
    []
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
          model: selectedModel,
          provider: selectedProvider,
        })
        setTopics((prev) => prev.map((topic) => (topic.id === id ? updated : topic)))
        toast.success('已智能重命名')
      } catch (error) {
        console.error('[chat] auto rename topic failed', error)
        toast.error('智能重命名失败')
      } finally {
        if (autoRenamingTopicIdRef.current === id) autoRenamingTopicIdRef.current = null
        setAutoRenamingTopicId((currentId) => (currentId === id ? null : currentId))
      }
    },
    [isBusy, messagesCache, selectedModel, selectedProvider]
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
        toast.success(`已删除 ${deletedIds.length} 个话题`)
      } catch (error) {
        console.error('[chat] deleteTopics failed', error)
        toast.error('批量删除话题失败')
        throw error
      }
    },
    [activeTopicId, agentId, pushChatHref]
  )

  const handleDeleteProject = useCallback(
    async (projectName: string) => {
      const topicIds = topics.filter((topic) => topic.projectName === projectName).map((topic) => topic.id)
      try {
        await Promise.all(topicIds.map((id) => deleteTopic(id)))
        const deleted = new Set(topicIds)
        setMessagesCache((prev) => {
          if (deleted.size === 0) return prev
          const next = new Map(prev)
          for (const id of deleted) next.delete(id)
          return next
        })
        setTopics((prev) => prev.filter((topic) => !deleted.has(topic.id)))
        if (activeTopicId && deleted.has(activeTopicId)) pushChatHref(agentId)

        const api = getDesktopApi()
        if (api?.listProjects && api.deleteProject) {
          const desktopProject = (await api.listProjects()).find((project) => project.name === projectName)
          if (desktopProject) await api.deleteProject(desktopProject.id)
        }

        toast.success(`已删除项目「${projectName}」及 ${topicIds.length} 个话题`)
      } catch (error) {
        console.error('[chat] deleteProject failed', error)
        toast.error('删除项目失败')
        throw error
      }
    },
    [activeTopicId, agentId, pushChatHref, topics]
  )

  const handleParamsChange = useCallback(
    (patch: Partial<ChatLlmParams>) => {
      setParams(agentId, patch)
    },
    [agentId, setParams]
  )

  const handleSearchModeChange = useCallback(
    (mode: ChatSearchMode) => {
      setSearchMode(mode)
    },
    [setSearchMode]
  )

  const handlePermissionModeChange = useCallback(
    async (mode: ChatPermissionMode) => {
      if (mode === 'full') {
        await ensureFullAccess(activeTopicId ?? 'draft')
      }
      if (!activeTopicId) {
        setPermissionMode(mode)
        return
      }

      try {
        const updated = await updateTopic(activeTopicId, { permissionMode: mode })
        setTopics((previous) => previous.map((topic) => (topic.id === activeTopicId ? updated : topic)))
        setPermissionMode(mode)
      } catch (error) {
        console.error('[chat] update permission mode failed', error)
        toast.error('权限模式保存失败')
        throw error
      }
    },
    [activeTopicId, ensureFullAccess, setPermissionMode]
  )

  const handleTopicsRefresh = useCallback(() => {
    refreshTopics()
  }, [refreshTopics])

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
  const permissionSyncKey = `${activeTopicId ?? 'draft'}:${permissionMode}`
  const [syncedPermissionKey, setSyncedPermissionKey] = useState<string | null>(null)

  useEffect(() => {
    if (!isDesktop || permissionModeInitialized) return
    if (activeTopicId === null) {
      initializePermissionMode(getPendingChatPermissionMode())
      return
    }
    if (topicsLoadedAgentId !== agentId || !activeTopic) return
    initializePermissionMode(getPendingChatPermissionMode())
  }, [
    activeTopic,
    activeTopicId,
    agentId,
    initializePermissionMode,
    isDesktop,
    permissionModeInitialized,
    topicsLoadedAgentId,
  ])

  useEffect(() => {
    if (!isDesktop || activeTopicId === null) {
      setSyncedPermissionKey(permissionSyncKey)
      return
    }
    if (!permissionModeInitialized) return
    if (topicsLoadedAgentId !== agentId) return
    if (!activeTopic) {
      setSyncedPermissionKey(permissionSyncKey)
      return
    }
    if (activeTopic.permissionMode === permissionMode && permissionMode !== 'full') {
      setSyncedPermissionKey(permissionSyncKey)
      return
    }

    let cancelled = false
    const syncMode = async () => {
      if (permissionMode === 'full') await ensureFullAccess(activeTopicId)
      if (activeTopic.permissionMode === permissionMode) return activeTopic
      return updateTopic(activeTopicId, { permissionMode })
    }

    syncMode()
      .then((updated) => {
        if (cancelled) return
        setTopics((previous) => previous.map((topic) => (topic.id === activeTopicId ? updated : topic)))
        setSyncedPermissionKey(permissionSyncKey)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[chat] sync global permission mode failed', error)
        toast.error('会话权限同步失败，请重试')
      })
    return () => {
      cancelled = true
    }
  }, [
    activeTopic,
    activeTopicId,
    agentId,
    isDesktop,
    ensureFullAccess,
    permissionMode,
    permissionModeInitialized,
    permissionSyncKey,
    topicsLoadedAgentId,
  ])

  const messagesReady = activeTopicId === null ? true : loadedTopicId === activeTopicId
  const permissionModeReady =
    !isDesktop ||
    (permissionModeInitialized &&
      (activeTopicId === null ||
        (topicsLoadedAgentId === agentId && (!activeTopic || syncedPermissionKey === permissionSyncKey))))
  // Keep ChatView mounted while a permission mode is being synced. Remounting
  // useChat for a settings change can reset the active topic's in-memory turn.
  const chatReady = messagesReady
  const inputBusy = isBusy || !messagesReady || !permissionModeReady
  const hasActiveMessages =
    activeTopicId !== null &&
    ((messagesCache.get(activeTopicId)?.length ?? 0) > 0 ||
      (loadedTopicId === activeTopicId && initialMessages.length > 0))
  const handleInputSend = useCallback(
    async (text: string, files: File[]) => {
      if (!permissionModeReady) {
        toast.error('会话权限仍在同步，请稍后重试')
        return
      }
      await chatActionsRef.current.send(text, files)
    },
    [permissionModeReady]
  )

  return (
    <ChatLayout
      busy={isBusy}
      hasMessages={hasActiveMessages}
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
          onNewTopicInProject={handleNewTopicInProject}
          onProjectChange={handleProjectChange}
          onSelectTopic={handleSelectTopic}
          onRenameTopic={handleRenameTopic}
          onDeleteTopic={handleDeleteTopic}
          onDeleteTopics={handleDeleteTopics}
          onDeleteProject={handleDeleteProject}
        />
      }
      topic={activeTopic}
      right={
        <WorkPanel topic={activeTopic} topicTitle={topicTitle} value={params} onChange={handleParamsChange} />
      }
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
        <Flex className={[styles.page, 'flex-col']}>
          {chatReady ? (
            <ChatView
              key={`${agentId}:${activeTopicId ?? 'draft'}`}
              agentId={agentId}
              initialMessages={activeTopicId === null ? EMPTY_MESSAGES : initialMessages}
              topicId={activeTopicId}
              onBindActions={handleBindActions}
              onBusyChange={handleBusyChange}
              onCacheMessages={handleCacheMessages}
              onSelectOpeningQuestion={handleSelectOpeningQuestion}
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
              prefill={inputPrefill}
              prefillKey={inputPrefillKey}
              searchMode={searchMode}
              topicId={activeTopicId}
              onPermissionModeChange={isDesktop ? handlePermissionModeChange : undefined}
              onSearchModeChange={handleSearchModeChange}
              onSend={handleInputSend}
              onStop={handleInputStop}
            />
          </WideScreenContainer>
        </Flex>
      )}
    </ChatLayout>
  )
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
