'use client'

import { Flex } from '@pure/ui'
import { toast, createStaticStyles } from '@lobehub/ui'
import type { UIMessage } from 'ai'
import { useRouter, useSearchParams } from 'next/navigation'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DEFAULT_CHAT_ADVANCED_SETTINGS } from '@pure/types'
import type { ChatAdvancedSettings, ChatPermissionMode } from '@pure/types'

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
import {
  getPendingChatPermissionMode,
  getPendingChatProject,
  setPendingChatProject,
} from '@/features/chat/chatLocalStorage'
import ChatMessagesSkeleton from '@/features/chat/ChatMessagesSkeleton'
import { resolveNewChatProject } from '@/features/chat/chatProject'
import type { ChatViewActions } from '@/features/chat/ChatView'
import ChatView from '@/features/chat/ChatView'
import WorkPanel from '@/features/chat/WorkPanel'
import TopicSidebar from '@/features/chat/TopicSidebar'
import WideScreenContainer from '@/features/chat/WideScreenContainer'
import { getChatDraftKey, useChatDraftStore } from '@/features/chat/store/useChatDraftStore'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import {
  deleteChatSessions,
  findChatSession,
  topicRuntimeKey,
  useChatRuntimeStore,
} from '@/features/chat/runtime/store'
import { getChatSettingsKey } from '@/features/chat/advancedSettings'
import type { ChatSearchMode, LocalChatTopic, TopicDeleteScope, TopicUpdate } from '@/features/chat/types'
import { toActiveCommunityAgent } from '@/features/community/toActiveCommunityAgent'
import { fetchAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { getDesktopApi } from '@/types/desktop'
import { useSession } from '@/libs/better-auth/client'
import type { DesktopProject } from '@/types/desktop'

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
}))

const ChatPageContent = memo(({ userId }: { userId: string }) => {
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
  const runtimeSession = useChatRuntimeStore((state) =>
    state.sessions.get(JSON.stringify([userId, agentId, activeTopicId]))
  )
  const isBusy = useChatRuntimeStore((state) => state.busy[topicRuntimeKey(agentId, activeTopicId)] ?? false)
  const waitingApproval = useChatRuntimeStore(
    (state) => state.waitingApproval[topicRuntimeKey(agentId, activeTopicId)] ?? false
  )
  const topicsRevision = useChatRuntimeStore((state) => state.topicsRevision[agentId] ?? 0)

  const upsertLocalAgent = useAgentsStore((s) => s.upsertLocal)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)
  const agents = useAgentsStore((s) => s.agents)

  const advancedSettings = useChatUiStore(
    (s) => s.advancedSettingsByAgent[getChatSettingsKey(userId, agentId)] ?? DEFAULT_CHAT_ADVANCED_SETTINGS
  )
  const permissionMode = useChatUiStore((s) => s.permissionMode)
  const permissionModeInitialized = useChatUiStore((s) => s.permissionModeInitialized)
  const searchMode = useChatUiStore((s) => s.searchMode)
  const initializePermissionMode = useChatUiStore((s) => s.initializePermissionMode)
  const setPermissionMode = useChatUiStore((s) => s.setPermissionMode)
  const setAdvancedSettings = useChatUiStore((s) => s.setAdvancedSettings)
  const setSearchMode = useChatUiStore((s) => s.setSearchMode)

  const [topics, setTopics] = useState<LocalChatTopic[]>([])
  const [draftProjectName, setDraftProjectName] = useState<string | null>(null)
  const draftProjectTouchedRef = useRef(false)
  const [topicsLoadedAgentId, setTopicsLoadedAgentId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>(runtimeSession?.chat.messages ?? EMPTY_MESSAGES)
  // Tracks which topicId the currently-loaded initialMessages belong to.
  // undefined = not yet loaded; null = draft (empty); string = that topic's messages.
  const [loadedTopicId, setLoadedTopicId] = useState<string | null | undefined>(() =>
    isClient && (activeTopicId === null || runtimeSession) ? activeTopicId : undefined
  )
  const [messagesTopicKey, setMessagesTopicKey] = useState<string | null | undefined>(() =>
    isClient ? activeTopicId : undefined
  )
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
      const cached = runtimeSession?.chat.messages ?? messagesCache.get(activeTopicId)
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
      if (prev.get(id) === messages) return prev
      const next = new Map(prev)
      next.set(id, messages)
      return next
    })
  }, [])

  const handleBindActions = useCallback((actions: ChatViewActions) => {
    chatActionsRef.current = actions
  }, [])

  const handleInputStop = useCallback(() => {
    findChatSession(userId, agentId, activeTopicId)?.stop()
  }, [activeTopicId, agentId, userId])

  const handleSelectOpeningQuestion = useCallback(
    (question: string) => {
      useChatDraftStore.getState().setText(getChatDraftKey(agentId, activeTopicId), question)
      setInputPrefillKey((key) => key + 1)
    },
    [activeTopicId, agentId]
  )

  const currentWorkspaceRef = useRef('')
  useLayoutEffect(() => {
    currentWorkspaceRef.current = `${userId}:${agentId}`
    return () => {
      currentWorkspaceRef.current = ''
    }
  }, [agentId, userId])

  const refreshTopics = useCallback(async () => {
    if (!agentId) return
    try {
      const items = await fetchTopics(agentId)
      if (currentWorkspaceRef.current !== `${userId}:${agentId}`) return
      setTopics(items)
      setTopicsLoadedAgentId(agentId)
    } catch (error) {
      console.error('[chat] refreshTopics failed', error)
    }
  }, [agentId, userId])

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
  }, [agentId, isClient, topicsRevision, userId])

  // Soft-refresh messages for the active topic. Cache-first paint happens above
  // during render; this effect only hits the network.
  //
  // Once this topic is already on screen, do NOT push GET results into
  // `initialMessages` — a late/stale response would remount-seed older history.
  // A runtime instance is authoritative, including while its view is unmounted.
  const loadedTopicIdRef = useRef(loadedTopicId)
  useLayoutEffect(() => {
    loadedTopicIdRef.current = loadedTopicId
  }, [loadedTopicId])

  useEffect(() => {
    if (!isClient || activeTopicId === null) return
    const existingSession = findChatSession(userId, agentId, activeTopicId)
    if (existingSession) {
      existingSession.flush()
      return
    }

    let cancelled = false

    fetchMessages(activeTopicId)
      .then((msgs) => {
        if (cancelled) return
        if (findChatSession(userId, agentId, activeTopicId)) return

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
  }, [activeTopicId, agentId, isClient, userId])

  const handleNewTopic = useCallback(() => {
    // Already on draft for this agent — no-op.
    if (activeTopicId === null) return
    pushChatHref(agentId)
  }, [activeTopicId, agentId, pushChatHref])

  const handleNewTopicInProject = useCallback(
    (projectName: string) => {
      draftProjectTouchedRef.current = true
      setDraftProjectName(projectName)
      if (activeTopicId === null) {
        setPendingChatProject({ name: projectName })
        return
      }
      setPendingChatProject({ name: projectName })
      pushChatHref(agentId)
    },
    [activeTopicId, agentId, pushChatHref]
  )

  useEffect(() => {
    if (!isClient || activeTopicId !== null) return
    draftProjectTouchedRef.current = false
    let cancelled = false
    resolveNewChatProject(getPendingChatProject())
      .then((project) => {
        if (!cancelled && !draftProjectTouchedRef.current) setDraftProjectName(project?.name ?? null)
      })
      .catch(() => {
        if (!cancelled) toast.error('加载默认项目失败')
      })
    return () => {
      cancelled = true
    }
  }, [activeTopicId, isClient])

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

  const handleUpdateTopic = useCallback(async (id: string, patch: TopicUpdate, errorText: string) => {
    try {
      const updated = await updateTopic(id, patch)
      setTopics((prev) => prev.map((topic) => (topic.id === id ? updated : topic)))
    } catch (error) {
      console.error('[chat] updateTopic failed', error)
      toast.error(errorText)
    }
  }, [])

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
      if (useChatRuntimeStore.getState().busy[topicRuntimeKey(agentId, id)] || autoRenamingTopicIdRef.current) return

      autoRenamingTopicIdRef.current = id
      setAutoRenamingTopicId(id)
      try {
        const session = findChatSession(userId, agentId, id)
        if (session) await session.flush()
        else {
          const cachedMessages = messagesCache.get(id)
          if (cachedMessages) await putMessages(id, cachedMessages)
        }

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
    [agentId, messagesCache, selectedModel, selectedProvider, userId]
  )

  const handleProjectChange = useCallback(
    (id: string, projectName: string | null) => handleUpdateTopic(id, { projectName }, '移动到项目失败'),
    [handleUpdateTopic]
  )

  const handleComposerProjectChange = useCallback(
    async (project: DesktopProject | null) => {
      const api = getDesktopApi()
      const projectName = project?.name ?? null

      if (activeTopicId === null) {
        draftProjectTouchedRef.current = true
        await api?.setPermissionScope?.('draft', project?.rootPath ?? null)
        setDraftProjectName(projectName)
        setPendingChatProject(project ? { name: project.name, rootPath: project.rootPath } : null)
        return
      }

      if (!api?.getPermissionScope || !api.setPermissionScope) return
      let previousScope: string | null = null
      let scopeChanged = false
      try {
        previousScope = (await api.getPermissionScope(activeTopicId)).scope
        await api.setPermissionScope(activeTopicId, project?.rootPath ?? null)
        scopeChanged = true
        const updated = await updateTopic(activeTopicId, { projectName })
        setTopics((previous) => previous.map((topic) => (topic.id === activeTopicId ? updated : topic)))
      } catch (error) {
        if (scopeChanged) {
          await api.setPermissionScope(activeTopicId, previousScope).catch((restoreError) => {
            console.error('[chat] restore project permission scope failed', restoreError)
          })
        }
        throw error
      }
    },
    [activeTopicId]
  )

  const handleDeleteTopic = useCallback(
    async (id: string) => {
      try {
        await deleteChatSessions(userId, agentId, [id], async () => {
          await deleteTopic(id)
          return [id]
        })
        useChatDraftStore.getState().clearDrafts([getChatDraftKey(agentId, id)])
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
    [activeTopicId, agentId, pushChatHref, userId]
  )

  const handleDeleteTopics = useCallback(
    async (scope: TopicDeleteScope) => {
      try {
        const candidates = topics.filter((topic) => scope === 'all' || !topic.favorite).map((topic) => topic.id)
        const deletedIds = await deleteChatSessions(userId, agentId, candidates, () => deleteTopicsApi(agentId, scope))
        useChatDraftStore.getState().clearDrafts(deletedIds.map((id) => getChatDraftKey(agentId, id)))
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
    [activeTopicId, agentId, pushChatHref, topics, userId]
  )

  const handleDeleteProject = useCallback(
    async (projectName: string) => {
      const topicIds = topics.filter((topic) => topic.projectName === projectName).map((topic) => topic.id)
      try {
        const results = await Promise.allSettled(
          topicIds.map((id) =>
            deleteChatSessions(userId, agentId, [id], async () => {
              await deleteTopic(id)
              return [id]
            })
          )
        )
        const deletedIds = results.flatMap((result, index) => (result.status === 'fulfilled' ? [topicIds[index]] : []))
        useChatDraftStore.getState().clearDrafts(deletedIds.map((id) => getChatDraftKey(agentId, id)))
        const deleted = new Set(deletedIds)
        setMessagesCache((prev) => {
          if (deleted.size === 0) return prev
          const next = new Map(prev)
          for (const id of deleted) next.delete(id)
          return next
        })
        setTopics((prev) => prev.filter((topic) => !deleted.has(topic.id)))
        if (activeTopicId && deleted.has(activeTopicId)) pushChatHref(agentId)

        const failure = results.find((result) => result.status === 'rejected')
        if (failure?.status === 'rejected') throw failure.reason

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
    [activeTopicId, agentId, pushChatHref, topics, userId]
  )

  const handleAdvancedSettingsChange = useCallback(
    (patch: Partial<ChatAdvancedSettings>) => {
      setAdvancedSettings(userId, agentId, patch)
    },
    [agentId, setAdvancedSettings, userId]
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
      if (!activeTopicId || isBusy || waitingApproval) {
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
    [activeTopicId, ensureFullAccess, isBusy, setPermissionMode, waitingApproval]
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
    if (isBusy || waitingApproval) return
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
    isBusy,
    waitingApproval,
    permissionSyncKey,
    topicsLoadedAgentId,
  ])

  const messagesReady = activeTopicId === null || Boolean(runtimeSession) || loadedTopicId === activeTopicId
  const permissionModeReady =
    !isDesktop ||
    (permissionModeInitialized &&
      (activeTopicId === null ||
        (topicsLoadedAgentId === agentId && (!activeTopic || syncedPermissionKey === permissionSyncKey))))
  // Keep ChatView mounted while a permission mode is being synced. Remounting
  // useChat for a settings change can reset the active topic's in-memory turn.
  const chatReady = messagesReady
  const inputBusy = isBusy || waitingApproval || !messagesReady || !permissionModeReady
  const cachedMessages = runtimeSession?.chat.messages ?? (activeTopicId ? messagesCache.get(activeTopicId) : undefined)
  const activeMessages = cachedMessages ?? (loadedTopicId === activeTopicId ? initialMessages : EMPTY_MESSAGES)
  const hasActiveMessages =
    activeTopicId !== null &&
    ((cachedMessages?.length ?? 0) > 0 || (loadedTopicId === activeTopicId && initialMessages.length > 0))
  const handleInputSend = useCallback(
    async (text: string, files: File[]) => {
      if (!messagesReady) return
      if (!permissionModeReady) {
        toast.error('会话权限仍在同步，请稍后重试')
        return
      }
      await chatActionsRef.current.send(text, files)
    },
    [messagesReady, permissionModeReady]
  )

  return (
    <ChatLayout
      busy={isBusy}
      hasMessages={hasActiveMessages}
      messages={activeMessages}
      left={
        <TopicSidebar
          activeTopicId={activeTopicId}
          agents={agents}
          autoRenameDisabled={autoRenamingTopicId !== null}
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
        <WorkPanel
          topic={activeTopic}
          topicTitle={topicTitle}
          value={advancedSettings}
          onChange={handleAdvancedSettingsChange}
        />
      }
      title={topicTitle}
      autoRenamingTopicId={autoRenamingTopicId}
      onAutoRenameTopic={handleAutoRenameTopic}
      onDeleteTopic={handleDeleteTopic}
      onFavoriteTopic={handleFavoriteTopic}
      onRenameTopic={handleRenameTopic}
    >
      {!isClient ? (
        <div className={'w-full h-full'} />
      ) : (
        <Flex className={[styles.page, 'flex-col']}>
          {chatReady ? (
            <ChatView
              key={`${userId}:${agentId}:${activeTopicId ?? 'draft'}`}
              userId={userId}
              agentId={agentId}
              initialMessages={
                runtimeSession?.chat.messages ?? (activeTopicId === null ? EMPTY_MESSAGES : initialMessages)
              }
              topicId={activeTopicId}
              onBindActions={handleBindActions}
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
              agentId={agentId}
              isBusy={inputBusy}
              permissionMode={isDesktop ? permissionMode : undefined}
              prefillKey={inputPrefillKey}
              projectName={activeTopicId === null ? draftProjectName : (activeTopic?.projectName ?? null)}
              searchMode={searchMode}
              topicId={activeTopicId}
              onPermissionModeChange={isDesktop ? handlePermissionModeChange : undefined}
              onProjectChange={isDesktop ? handleComposerProjectChange : undefined}
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

ChatPageContent.displayName = 'ChatPageContent'

const ChatPage = memo(() => {
  const { data: auth } = useSession()
  return auth?.user ? <ChatPageContent key={auth.user.id} userId={auth.user.id} /> : null
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
