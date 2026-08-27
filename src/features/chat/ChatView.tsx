'use client'

import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai'
import type { UIMessage } from 'ai'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ChatPermissionMode } from '@pure/types'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import { buildChatHref } from '@/features/chat/buildChatHref'
import { createTopic, putMessages, updateToolApproval, upsertToolApproval } from '@/features/chat/chatApi'
import {
  claimPendingChatFiles,
  claimPendingChatText,
  claimPendingTopicSend,
  claimPendingTopicSendFiles,
  finishPendingChatText,
  finishPendingTopicSend,
  setPendingTopicSend,
  setPendingTopicSendFiles,
  truncateTitle,
} from '@/features/chat/chatLocalStorage'
import ChatErrorBanner from '@/features/chat/ChatErrorBanner'
import ChatMessages from '@/features/chat/ChatMessages'
import { getMessageText, withMessageText } from '@/features/chat/messageText'
import type { ChatSearchMode } from '@/features/chat/types'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { isSettingsProviderId } from '@/features/settings/provider/const'
import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'
import { markFirstConversion, trackAcquisitionEvent } from '@/libs/analytics/acquisition'
import { useRouter } from '@/utils/navigation'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopLocalToolRequest } from '@/types/desktop'

const EMPTY_MESSAGES: UIMessage[] = []
const LOCAL_TOOL_NAMES = new Set([
  'editFile',
  'getSystemInfo',
  'getCommandOutput',
  'killCommand',
  'listFiles',
  'moveFile',
  'readFile',
  'runCommand',
  'searchFiles',
  'writeFile',
])
const SAFE_LOCAL_TOOL_NAMES = new Set(['getCommandOutput', 'getSystemInfo', 'listFiles', 'readFile', 'searchFiles'])

const fileToPart = (file: File): Promise<{ type: 'file'; mediaType: string; url: string; filename: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        type: 'file',
        mediaType: file.type || 'application/octet-stream',
        url: String(reader.result),
        filename: file.name,
      })
    reader.onerror = () => reject(reader.error ?? new Error('读取附件失败'))
    reader.readAsDataURL(file)
  })

const buildTopicTitle = (text: string, files: File[]) => {
  const attachmentLabel = files.length > 0 ? `📎 ${files.map((file) => file.name).join('、')}` : ''
  const trimmedText = text.trim()
  if (!attachmentLabel) return truncateTitle(trimmedText || '附件')
  return [trimmedText ? truncateTitle(trimmedText) : '', attachmentLabel].filter(Boolean).join(' · ')
}

/** Stable content fingerprint so hydrate / Strict Mode remounts do not re-PUT identical snapshots. */
const messagesSignature = (messages: UIMessage[]) =>
  JSON.stringify(
    messages.map((message) => ({
      id: message.id,
      metadata: message.metadata,
      parts: message.parts,
      role: message.role,
    }))
  )

const chatTransport = new DefaultChatTransport({
  api: '/api/chat',
  credentials: 'include',
  headers: (): Record<string, string> => {
    const provider = useHomeStore.getState().selectedProvider
    if (!isSettingsProviderId(provider) || provider === 'purechat') return {}

    const apiKey = useProviderConfigStore.getState().configs[provider]?.apiKey.trim() ?? ''
    if (!apiKey) return {}

    return { Authorization: `Bearer ${apiKey}` }
  },
})

export type ChatViewActions = {
  send: (text: string, files?: File[]) => void | Promise<void>
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
  permissionMode?: ChatPermissionMode
  searchMode: ChatSearchMode
}

const ChatView = memo<ChatViewProps>(
  ({
    agentId,
    topicId,
    initialMessages,
    onBusyChange,
    onCacheMessages,
    onBindActions,
    onTopicsRefresh,
    permissionMode,
    searchMode,
  }) => {
    const router = useRouter()
    const selectedModel = useHomeStore((s) => s.selectedModel)
    const selectedProvider = useHomeStore((s) => s.selectedProvider)
    const activeAgent = useHomeStore((s) => s.activeAgent)
    const providerBaseURL = useProviderConfigStore((s) =>
      isSettingsProviderId(selectedProvider) && selectedProvider !== 'purechat'
        ? (s.configs[selectedProvider]?.baseURL.trim() ?? '')
        : ''
    )
    const selectedModelConfig = useProviderConfigStore((s) =>
      isSettingsProviderId(selectedProvider)
        ? s.configs[selectedProvider]?.models.find((model) => model.id === selectedModel)
        : undefined
    )
    const selectedModelAbilities = selectedModelConfig?.abilities

    const chatId = `purechat-${agentId}-${topicId ?? 'draft'}`

    const desktopApi = getDesktopApi()
    const fullGrantTopicRef = useRef<string | null>(null)
    useEffect(() => {
      if (!desktopApi || permissionMode !== 'full' || !topicId || fullGrantTopicRef.current === topicId) return
      fullGrantTopicRef.current = topicId
      void desktopApi.requestFullAccess(topicId).then((result) => {
        if (!result.granted) fullGrantTopicRef.current = null
      })
    }, [desktopApi, permissionMode, topicId])

    const {
      addToolApprovalResponse,
      addToolOutput,
      clearError,
      error,
      messages,
      sendMessage,
      setMessages,
      status,
      stop,
    } = useChat({
      id: chatId,
      messages: initialMessages,
      // Throttle UI updates so Markdown/Streamdown isn't re-rendered on every chunk
      throttle: 50,
      transport: chatTransport,
      sendAutomaticallyWhen: ({ messages: nextMessages }) =>
        lastAssistantMessageIsCompleteWithToolCalls({ messages: nextMessages }) ||
        lastAssistantMessageIsCompleteWithApprovalResponses({ messages: nextMessages }),
      onToolCall: async ({ toolCall }) => {
        if (toolCall.dynamic || !desktopApi || !LOCAL_TOOL_NAMES.has(toolCall.toolName)) return
        const args = (toolCall.input && typeof toolCall.input === 'object' ? toolCall.input : {}) as Record<
          string,
          unknown
        >
        const shouldApprove =
          permissionMode === 'ask' || (permissionMode === 'auto' && !SAFE_LOCAL_TOOL_NAMES.has(toolCall.toolName))
        if (topicId) {
          await upsertToolApproval(topicId, {
            apiName: toolCall.toolName,
            args,
            identifier: 'desktop-local-system',
            toolCallId: toolCall.toolCallId,
          }).catch((error) => console.error('[chat] tool approval record failed', error))
        }
        if (shouldApprove) return
        const request: DesktopLocalToolRequest = {
          args,
          mode: permissionMode ?? 'auto',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName as DesktopLocalToolRequest['toolName'],
          topicId: topicId ?? 'draft',
        }
        void desktopApi.executeLocalTool(request).then((output) => {
          if (topicId) {
            void updateToolApproval(
              topicId,
              toolCall.toolCallId,
              output.success ? 'completed' : 'failed',
              output.success ? undefined : output.content
            )
          }
          addToolOutput({ output, tool: toolCall.toolName as never, toolCallId: toolCall.toolCallId })
        })
      },
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
    const responsePendingRef = useRef(false)

    useEffect(() => {
      if (isBusy) {
        responsePendingRef.current = true
        return
      }
      if (status === 'error') {
        responsePendingRef.current = false
        return
      }
      if (!responsePendingRef.current || status !== 'ready') return
      responsePendingRef.current = false

      if (messages.at(-1)?.role !== 'assistant') return
      trackAcquisitionEvent('chat_response_completed', {
        first: markFirstConversion('chat_response'),
        model: selectedModel,
        provider: selectedProvider,
      })
    }, [isBusy, messages, selectedModel, selectedProvider, status])

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
      [topicId]
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
        ...(topicId ? { topicId } : {}),
        ...(desktopApi ? { clientCapabilities: { desktop: true } } : {}),
        model: selectedModel,
        ...(selectedModelAbilities ? { modelAbilities: selectedModelAbilities } : {}),
        ...(permissionMode ? { permissionMode } : {}),
        provider: selectedProvider,
        searchMode,
        ...(providerBaseURL ? { baseURL: providerBaseURL } : {}),
        ...(activeAgent?.systemRole ? { system: activeAgent.systemRole } : {}),
      }),
      [
        activeAgent,
        desktopApi,
        permissionMode,
        providerBaseURL,
        searchMode,
        selectedModel,
        selectedModelAbilities,
        selectedProvider,
        topicId,
      ]
    )

    const sendWithBody = useCallback(
      async (text: string, files: File[] = []) => {
        clearError()
        const fileParts = await Promise.all(files.map(fileToPart))
        await sendMessage(
          { text, ...(fileParts.length > 0 ? { files: fileParts } : {}) },
          {
            body: requestBody,
          }
        )
        onTopicsRefresh()
      },
      [clearError, onTopicsRefresh, requestBody, sendMessage]
    )

    const sendOrSolidify = useCallback(
      async (text: string, files: File[] = []) => {
        if (!topicId) {
          try {
            const topic = await createTopic(agentId, buildTopicTitle(text, files), permissionMode)
            onCacheMessages(topic.id, EMPTY_MESSAGES)
            onTopicsRefresh()
            setPendingTopicSend(text)
            setPendingTopicSendFiles(files)
            router.replace(buildChatHref(agentId, topic.id))
          } catch (error) {
            console.error('[chat] createTopic failed', error)
          }
          return
        }

        await sendWithBody(text)
      },
      [agentId, onCacheMessages, onTopicsRefresh, permissionMode, router, sendWithBody, topicId]
    )

    const handleSend = useCallback(
      async (text: string, files: File[] = []) => {
        if (isBusy) return
        await sendOrSolidify(text, files)
      },
      [isBusy, sendOrSolidify]
    )

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
      const pendingFiles = claimPendingTopicSendFiles()
      if (pendingTopic || pendingFiles.length > 0) {
        sendWithBodyRef.current(pendingTopic ?? '', pendingFiles).finally(() => {
          finishPendingTopicSend()
        })
        return
      }

      const pending = claimPendingChatText()
      const pendingChatFiles = claimPendingChatFiles()
      if (!pending && pendingChatFiles.length === 0) return

      sendOrSolidifyRef.current(pending ?? '', pendingChatFiles).finally(() => {
        finishPendingChatText(pending ?? '')
      })
    }, [])

    const handleDelete = useCallback(
      (id: string) => {
        setMessages((prev) => prev.filter((message) => message.id !== id))
      },
      [setMessages]
    )

    const handleEdit = useCallback(
      (id: string, text: string) => {
        setMessages((prev) => prev.map((message) => (message.id === id ? withMessageText(message, text) : message)))
      },
      [setMessages]
    )

    const handleStop = useCallback(() => {
      stop()
    }, [stop])

    const handleToolApproval = useCallback(
      (toolCallId: string, toolName: string, args: Record<string, unknown>, approved: boolean) => {
        if (!desktopApi || !topicId) return
        if (!approved) {
          void updateToolApproval(topicId, toolCallId, 'denied')
          addToolOutput({
            output: { content: '用户拒绝了该操作', success: false },
            tool: toolName as never,
            toolCallId,
          })
          return
        }
        const request: DesktopLocalToolRequest = {
          approved: true,
          args,
          mode: permissionMode ?? 'ask',
          toolCallId,
          toolName: toolName as DesktopLocalToolRequest['toolName'],
          topicId,
        }
        void desktopApi.executeLocalTool(request).then((output) => {
          void updateToolApproval(
            topicId,
            toolCallId,
            output.success ? 'completed' : 'failed',
            output.success ? undefined : output.content
          )
          addToolOutput({ output, tool: toolName as never, toolCallId })
        })
      },
      [addToolOutput, desktopApi, permissionMode, topicId]
    )

    const handleServerToolApproval = useCallback(
      (approvalId: string, toolCallId: string, approved: boolean) => {
        if (topicId) void updateToolApproval(topicId, toolCallId, approved ? 'approved' : 'denied')
        addToolApprovalResponse({ approved, id: approvalId })
      },
      [addToolApprovalResponse, topicId]
    )

    const agents = useAgentsStore((s) => s.agents)
    const agentMeta = useMemo(() => {
      const a = agents.find((x) => x.id === agentId)
      return a
        ? { avatar: a.avatar, title: a.title }
        : { avatar: DEFAULT_PURE_AI_META.avatar, title: DEFAULT_PURE_AI_META.title }
    }, [agents, agentId])

    const handleRegenerate = useCallback(
      async (id: string) => {
        const idx = messagesRef.current.findIndex((m) => m.id === id)
        if (idx < 0) return
        const prevUser = messagesRef.current
          .slice(0, idx)
          .reverse()
          .find((m) => m.role === 'user')
        if (!prevUser) return
        clearError()
        setMessages((prev) => prev.filter((m) => m.id !== id))
        await sendMessage({ text: getMessageText(prevUser), messageId: prevUser.id }, { body: requestBody })
      },
      [clearError, requestBody, sendMessage, setMessages]
    )

    useLayoutEffect(() => {
      onBindActions({ send: handleSend, stop: handleStop })
    }, [handleSend, handleStop, onBindActions])

    return (
      <div className='relative flex min-h-0 min-w-0 flex-1 flex-col'>
        <ChatMessages
          agentMeta={agentMeta}
          disabled={isBusy}
          initialScrollToBottom={topicId !== null}
          isStreaming={isStreaming}
          messages={messages}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onRegenerate={handleRegenerate}
          onToolApproval={handleToolApproval}
          onServerToolApproval={handleServerToolApproval}
        />
        {error ? <ChatErrorBanner message={error.message} onDismiss={clearError} /> : null}
      </div>
    )
  }
)

ChatView.displayName = 'ChatView'

export default ChatView
