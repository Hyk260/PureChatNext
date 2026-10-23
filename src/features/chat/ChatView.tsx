'use client'

import { useChat } from '@ai-sdk/react'
import { Flex } from '@pure/ui'
import type { ChatPermissionMode } from '@pure/types'
import type { UIMessage } from 'ai'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import { buildChatHref, createTopic } from '@/features/chat/chatApi'
import {
  claimPendingChatFiles,
  claimPendingChatProject,
  claimPendingChatText,
  claimPendingTopicSend,
  claimPendingTopicSendFiles,
  finishPendingChatText,
  finishPendingTopicSend,
  truncateTitle,
} from '@/features/chat/chatLocalStorage'
import { resolveNewChatProject } from '@/features/chat/chatProject'
import ChatErrorBanner from '@/features/chat/ChatErrorBanner'
import ChatMessages from '@/features/chat/ChatMessages'
import {
  createChatSession,
  registerChatSession,
  topicRuntimeKey,
  useChatRuntimeStore,
} from '@/features/chat/runtime/store'
import type { ChatSearchMode } from '@/features/chat/types'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'
import { getDesktopApi } from '@/types/desktop'

const EMPTY_MESSAGES: UIMessage[] = []

const buildTopicTitle = (text: string, files: File[]) => {
  const attachmentLabel = files.length > 0 ? `📎 ${files.map((file) => file.name).join('、')}` : ''
  const trimmedText = text.trim()
  if (!attachmentLabel) return truncateTitle(trimmedText || '附件')
  return [trimmedText ? truncateTitle(trimmedText) : '', attachmentLabel].filter(Boolean).join(' · ')
}

export type ChatViewActions = {
  send: (text: string, files?: File[]) => void | Promise<void>
  stop: () => void
}

interface ChatViewProps {
  userId: string
  agentId: string
  topicId: string | null
  initialMessages: UIMessage[]
  onCacheMessages: (topicId: string, messages: UIMessage[]) => void
  onBindActions: (actions: ChatViewActions) => void
  onSelectOpeningQuestion?: (question: string) => void
  onTopicsRefresh: () => void
  permissionMode?: ChatPermissionMode
  searchMode: ChatSearchMode
}

const ChatView = memo<ChatViewProps>(
  ({
    userId,
    agentId,
    topicId,
    initialMessages,
    onCacheMessages,
    onBindActions,
    onSelectOpeningQuestion,
    onTopicsRefresh,
    permissionMode,
    searchMode,
  }) => {
    const router = useRouter()
    const selectedModel = useHomeStore((state) => state.selectedModel)
    const selectedProvider = useHomeStore((state) => state.selectedProvider)
    const activeAgent = useHomeStore((state) => state.activeAgent)
    const modelAbilities = useProviderConfigStore(
      (state) => state.configs[selectedProvider]?.models.find((model) => model.id === selectedModel)?.abilities
    )
    const [session] = useState(() => createChatSession(userId, agentId, topicId, initialMessages))
    const { messages, status, error, clearError } = useChat({ chat: session.chat })
    const runtimeKey = topicRuntimeKey(agentId, topicId)
    const isBusy = useChatRuntimeStore((state) => state.busy[runtimeKey] ?? false)
    const runningCommandCallIds = useChatRuntimeStore((state) => state.commands[runtimeKey])
    const creatingTopicRef = useRef(false)
    const mountedRef = useRef(false)
    const requestBody = useMemo(
      () => ({
        model: selectedModel,
        provider: selectedProvider,
        searchMode,
        ...(modelAbilities ? { modelAbilities } : {}),
        ...(permissionMode ? { permissionMode } : {}),
        ...(activeAgent?.systemRole ? { system: activeAgent.systemRole } : {}),
      }),
      [activeAgent?.systemRole, modelAbilities, permissionMode, searchMode, selectedModel, selectedProvider]
    )

    useLayoutEffect(() => {
      mountedRef.current = true
      registerChatSession(session)
      session.flush()
      return () => {
        mountedRef.current = false
      }
    }, [session])

    useLayoutEffect(() => {
      session.initializeOptions(requestBody)
    }, [requestBody, session])

    useEffect(() => {
      if (topicId && !isBusy) onCacheMessages(topicId, messages)
    }, [isBusy, messages, onCacheMessages, topicId])

    const sendOrSolidify = useCallback(
      async (text: string, files: File[] = []) => {
        if (topicId) {
          await session.send(text, files, requestBody)
          return
        }
        if (creatingTopicRef.current) return
        creatingTopicRef.current = true
        try {
          const pendingProject = await resolveNewChatProject(claimPendingChatProject())
          const topic = await createTopic(agentId, buildTopicTitle(text, files), permissionMode, pendingProject?.name)
          if (pendingProject?.rootPath) {
            await getDesktopApi()
              ?.setPermissionScope?.(topic.id, pendingProject.rootPath)
              .catch((error) => console.error('[chat] setPermissionScope failed', error))
          }
          const nextSession = createChatSession(userId, agentId, topic.id, EMPTY_MESSAGES)
          if (!registerChatSession(nextSession)) return
          const sending = nextSession.send(text, files, requestBody)
          // Starting the task precedes navigation, so a fast switch cannot lose the first send.
          if (mountedRef.current) {
            onCacheMessages(topic.id, EMPTY_MESSAGES)
            onTopicsRefresh()
            router.replace(buildChatHref(agentId, topic.id))
          }
          await sending
        } catch (error) {
          console.error('[chat] createTopic failed', error)
        } finally {
          creatingTopicRef.current = false
        }
      },
      [agentId, onCacheMessages, onTopicsRefresh, permissionMode, requestBody, router, session, topicId, userId]
    )

    const sendRef = useRef(sendOrSolidify)
    useLayoutEffect(() => {
      sendRef.current = sendOrSolidify
    }, [sendOrSolidify])
    const handoffStartedRef = useRef(false)
    useEffect(() => {
      if (handoffStartedRef.current) return
      handoffStartedRef.current = true
      const pendingTopic = claimPendingTopicSend()
      const topicFiles = claimPendingTopicSendFiles()
      if (pendingTopic || topicFiles.length > 0) {
        sendRef
          .current(pendingTopic ?? '', topicFiles)
          .catch((error) => console.error('[chat] pending send failed', error))
        finishPendingTopicSend()
        return
      }
      const pending = claimPendingChatText()
      const files = claimPendingChatFiles()
      if (!pending && files.length === 0) return
      sendRef.current(pending ?? '', files).catch((error) => console.error('[chat] pending send failed', error))
      finishPendingChatText(pending ?? '')
    }, [])

    useLayoutEffect(() => {
      onBindActions({ send: sendOrSolidify, stop: session.stop })
    }, [onBindActions, sendOrSolidify, session])

    const handleDelete = useCallback((id: string) => session.deleteMessage(id), [session])
    const handleEdit = useCallback((id: string, text: string) => session.edit(id, text), [session])
    const handleRegenerate = useCallback((id: string) => session.regenerate(id, requestBody), [requestBody, session])
    const handleToolApproval = useCallback(
      (id: string, name: string, args: Record<string, unknown>, approved: boolean) => {
        session.approveLocal(id, name, args, approved)
      },
      [session]
    )
    const handleServerToolApproval = useCallback(
      (approvalId: string, toolCallId: string, approved: boolean) => {
        session.approveServer(approvalId, toolCallId, approved)
      },
      [session]
    )

    const agents = useAgentsStore((state) => state.agents)
    const agentMeta = useMemo(() => {
      const agent = agents.find((item) => item.id === agentId) ?? DEFAULT_PURE_AI_META
      return {
        avatar: agent.avatar,
        openingMessage: agent.openingMessage,
        openingQuestions: agent.openingQuestions,
        title: agent.title,
      }
    }, [agents, agentId])

    return (
      <Flex className='relative min-h-0 min-w-0 flex-1 flex-col'>
        <ChatMessages
          agentMeta={agentMeta}
          disabled={isBusy}
          initialScrollToBottom={topicId !== null}
          isStreaming={status === 'streaming'}
          messages={messages}
          permissionMode={session.permissionMode ?? permissionMode}
          runningCommandCallIds={runningCommandCallIds}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onRegenerate={handleRegenerate}
          onSelectOpeningQuestion={onSelectOpeningQuestion}
          onToolApproval={handleToolApproval}
          onServerToolApproval={handleServerToolApproval}
        />
        {error ? <ChatErrorBanner message={error.message} onDismiss={clearError} /> : null}
      </Flex>
    )
  }
)

ChatView.displayName = 'ChatView'

export default ChatView
