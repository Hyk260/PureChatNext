'use client'

import { Button } from '@pure/ui'
import { RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CHANNEL_SESSION_POLL_MS,
  CHANNEL_STATUS_POLL_MS,
  ChannelConversationShell,
  ConversationExportDialog,
  LoadingConversation,
  getActiveChannelEventIds,
  hasActiveChannelMessages,
  isChannelImageFileName,
  mergeChannelMessages,
  MESSAGE_POLL_DELAYS,
  nextChannelMessagePollDelay,
  useCopyFeedback,
} from '@/features/admin/channel-conversation'
import { fetchWechatStatus, retryFailedWechatEvents } from '@/features/settings/messenger/wechatApi'
import type { WechatStatus } from '@/features/settings/messenger/wechatApi'

import { WechatMessagePane } from './WechatMessagePane'
import type { ChatPerspective, PendingAttachment } from './WechatMessagePane'
import { WechatSessionSidebar } from './WechatSessionSidebar'
import { fetchWechatDevSessionMessages, fetchWechatDevSessions, sendWechatDevMessage } from './wechatConversationApi'
import type { WechatDevMessage, WechatDevSession } from './wechatConversationApi'
import { createWechatConversationExport, createWechatExportFilename } from './wechatConversationExport'

const MAX_OUTBOUND_FILES = 5
const MAX_OUTBOUND_FILE_BYTES = 10 * 1024 * 1024

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function useVisiblePeriodicRefresh(
  task: (signal: AbortSignal) => Promise<unknown>,
  intervalMs: number,
  enabled: boolean
): () => void {
  const taskRef = useRef(task)
  const refreshRef = useRef<() => void>(() => {})

  useEffect(() => {
    taskRef.current = task
  }, [task])

  useEffect(() => {
    if (!enabled) {
      refreshRef.current = () => {}
      return
    }

    let controller: AbortController | null = null
    let inFlight = false
    let refreshPending = false
    let stopped = false
    let timer: number | undefined

    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
    }
    const schedule = () => {
      clearTimer()
      if (!stopped && document.visibilityState === 'visible') timer = window.setTimeout(run, intervalMs)
    }
    const run = async () => {
      clearTimer()
      if (stopped || document.visibilityState !== 'visible') return
      if (inFlight) {
        refreshPending = true
        return
      }
      inFlight = true
      controller = new AbortController()
      try {
        await taskRef.current(controller.signal)
      } catch {
        // Periodic fallback refreshes are best-effort; the next scheduled run retries.
      } finally {
        inFlight = false
        controller = null
        if (stopped || document.visibilityState !== 'visible') return
        if (refreshPending) {
          refreshPending = false
          void run()
        } else {
          schedule()
        }
      }
    }
    refreshRef.current = () => {
      clearTimer()
      if (document.visibilityState !== 'visible') {
        refreshPending = true
        return
      }
      if (inFlight) {
        refreshPending = true
        return
      }
      void run()
    }
    const onVisibilityChange = () => {
      clearTimer()
      if (document.visibilityState !== 'visible') {
        controller?.abort()
        return
      }
      refreshPending = false
      void run()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    schedule()
    return () => {
      stopped = true
      clearTimer()
      controller?.abort()
      refreshRef.current = () => {}
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, intervalMs])

  return useCallback(() => refreshRef.current(), [])
}

export default function WechatConversationPage() {
  const [status, setStatus] = useState<WechatStatus | null>(null)
  const [sessions, setSessions] = useState<WechatDevSession[]>([])
  const [bound, setBound] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WechatDevMessage[]>([])
  const [sessionMeta, setSessionMeta] = useState<WechatDevSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [draft, setDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [perspective, setPerspective] = useState<ChatPerspective>('agent')
  const [exportOpen, setExportOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const messagesRef = useRef<WechatDevMessage[]>([])
  const pauseMessagesRef = useRef<() => void>(() => {})
  const refreshMessagesNowRef = useRef<() => void>(() => {})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingRequestIdRef = useRef<string | null>(null)
  const selectedIdRef = useRef(selectedId)
  const pendingAttachmentsRef = useRef(pendingAttachments)
  const { copiedMessageId, copyText } = useCopyFeedback(setError)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])

  const refreshStatus = useCallback(async (signal?: AbortSignal) => {
    const next = await fetchWechatStatus(signal)
    setStatus(next)
    return next
  }, [])

  const refreshSessions = useCallback(async (signal?: AbortSignal) => {
    const data = await fetchWechatDevSessions(signal)
    setBound(data.bound)
    setSessions(data.sessions)
    setSelectedId((prev) => {
      if (prev && data.sessions.some((session) => session.id === prev)) return prev
      return data.sessions[0]?.id ?? null
    })
    return data
  }, [])

  const bootstrap = useCallback(
    async (signal: AbortSignal) => {
      try {
        await Promise.all([refreshStatus(signal), refreshSessions(signal)])
      } catch (err) {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [refreshSessions, refreshStatus]
  )

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void bootstrap(controller.signal)
    })
    return () => controller.abort()
  }, [bootstrap])

  const refreshStatusNow = useVisiblePeriodicRefresh(
    async (signal) => {
      await refreshStatus(signal).catch(() => {})
    },
    CHANNEL_STATUS_POLL_MS,
    !loading
  )
  const refreshSessionsNow = useVisiblePeriodicRefresh(
    async (signal) => {
      await refreshSessions(signal).catch(() => {})
    },
    CHANNEL_SESSION_POLL_MS,
    !loading
  )

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) {
        setDraft('')
        setExportOpen(false)
        setPendingAttachments((prev) => {
          for (const item of prev) {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
          }
          return []
        })
        pendingRequestIdRef.current = null
      }
    })
    return () => {
      active = false
    }
  }, [selectedId])

  useEffect(() => {
    return () => {
      for (const item of pendingAttachmentsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

  const selectedConversationVersion = sessions.find((session) => session.id === selectedId)?.conversationVersion

  useEffect(() => {
    if (!selectedId) {
      messagesRef.current = []
      pauseMessagesRef.current = () => {}
      refreshMessagesNowRef.current = () => {}
      let active = true
      queueMicrotask(() => {
        if (!active) return
        setMessages([])
        setSessionMeta(null)
      })
      return () => {
        active = false
      }
    }

    let controller: AbortController | null = null
    let cursor: string | undefined
    let conversationVersion: number | undefined
    let delay: number = MESSAGE_POLL_DELAYS[0]
    let inFlight = false
    let paused = false
    let refreshPending = false
    let stopped = false
    let timer: number | undefined

    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
    }
    const schedule = (waitMs: number) => {
      clearTimer()
      if (!stopped && document.visibilityState === 'visible') timer = window.setTimeout(run, waitMs)
    }
    const run = async () => {
      clearTimer()
      if (stopped || paused || document.visibilityState !== 'visible') return
      if (inFlight) {
        refreshPending = true
        return
      }
      inFlight = true
      controller = new AbortController()
      const initial = !cursor || conversationVersion === undefined
      try {
        const data = await fetchWechatDevSessionMessages(selectedId, {
          ...(initial
            ? { limit: 80 }
            : {
                conversationVersion,
                cursor,
                limit: 200,
                watchEventIds: getActiveChannelEventIds(messagesRef.current),
              }),
          signal: controller.signal,
        })
        if (stopped) return

        if (!initial && data.session.conversationVersion !== conversationVersion) {
          cursor = undefined
          conversationVersion = undefined
          messagesRef.current = []
          setMessages([])
          setSessionMeta(data.session)
          delay = MESSAGE_POLL_DELAYS[0]
          refreshPending = true
          refreshSessionsNow()
          return
        }

        const merged = mergeChannelMessages(initial ? [] : messagesRef.current, data.messages)
        messagesRef.current = merged.messages
        setMessages(merged.messages)
        setSessionMeta(data.session)
        setError(null)
        cursor = data.cursor ?? cursor
        conversationVersion = data.session.conversationVersion
        delay = initial
          ? MESSAGE_POLL_DELAYS[0]
          : nextChannelMessagePollDelay(delay, {
              changed: merged.changed,
              pending: hasActiveChannelMessages(merged.messages),
            })
        if (!initial && merged.changed) refreshSessionsNow()
      } catch (err) {
        if (!isAbortError(err) && !stopped) setError(err instanceof Error ? err.message : '消息加载失败')
      } finally {
        inFlight = false
        controller = null
        if (initial && !stopped) setMessagesLoading(false)
        if (stopped || paused || document.visibilityState !== 'visible') return
        if (refreshPending) {
          refreshPending = false
          void run()
        } else {
          schedule(delay)
        }
      }
    }
    pauseMessagesRef.current = () => {
      paused = true
      refreshPending = false
      clearTimer()
      controller?.abort()
    }
    refreshMessagesNowRef.current = () => {
      paused = false
      delay = MESSAGE_POLL_DELAYS[0]
      clearTimer()
      if (document.visibilityState !== 'visible') {
        refreshPending = true
        return
      }
      if (inFlight) {
        refreshPending = true
        controller?.abort()
        return
      }
      void run()
    }
    const onVisibilityChange = () => {
      clearTimer()
      if (paused) return
      if (document.visibilityState !== 'visible') {
        controller?.abort()
        return
      }
      delay = MESSAGE_POLL_DELAYS[0]
      refreshPending = false
      void run()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    queueMicrotask(() => {
      if (stopped) return
      messagesRef.current = []
      setMessages([])
      setSessionMeta(null)
      setMessagesLoading(true)
      void run()
    })
    return () => {
      stopped = true
      clearTimer()
      controller?.abort()
      pauseMessagesRef.current = () => {}
      refreshMessagesNowRef.current = () => {}
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshSessionsNow, selectedConversationVersion, selectedId])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    try {
      await retryFailedWechatEvents()
      refreshMessagesNowRef.current()
      refreshSessionsNow()
      refreshStatusNow()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试失败')
    } finally {
      setRetrying(false)
    }
  }, [refreshSessionsNow, refreshStatusNow])

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      for (const item of prev) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
      return []
    })
  }, [])

  const handlePickFiles = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return
    const current = pendingAttachmentsRef.current
    pendingRequestIdRef.current = null
    const remaining = MAX_OUTBOUND_FILES - current.length
    if (remaining <= 0) {
      setError(`一次最多添加 ${MAX_OUTBOUND_FILES} 个附件`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const accepted: PendingAttachment[] = []
    let errorMessage: string | null = null
    for (const file of Array.from(fileList)) {
      if (accepted.length >= remaining) {
        errorMessage = `一次最多添加 ${MAX_OUTBOUND_FILES} 个附件`
        break
      }
      if (file.size <= 0) {
        errorMessage ??= `附件「${file.name}」为空`
        continue
      }
      if (file.size > MAX_OUTBOUND_FILE_BYTES) {
        errorMessage ??= `附件「${file.name}」超过 10MB 限制`
        continue
      }
      accepted.push({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        previewUrl: isChannelImageFileName(file.name, file.type) ? URL.createObjectURL(file) : null,
      })
    }
    if (accepted.length) setPendingAttachments((prev) => [...prev, ...accepted])
    if (errorMessage) setError(errorMessage)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleRemovePendingAttachment = useCallback((id: string) => {
    pendingRequestIdRef.current = null
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (!selectedId || sending || !sessionMeta?.canSend) return
    const text = draft.trim()
    const files = pendingAttachments.map((item) => item.file)
    if (!text && files.length === 0) return
    const requestId = pendingRequestIdRef.current ?? crypto.randomUUID()
    pendingRequestIdRef.current = requestId
    setSending(true)
    setError(null)
    const sendingSessionId = selectedId
    pauseMessagesRef.current()
    try {
      const message = await sendWechatDevMessage(sendingSessionId, { files, requestId, text })
      if (selectedIdRef.current === sendingSessionId) {
        const merged = mergeChannelMessages(messagesRef.current, [message])
        messagesRef.current = merged.messages
        setMessages(merged.messages)
        setDraft('')
        clearPendingAttachments()
        pendingRequestIdRef.current = null
      }
      refreshSessionsNow()
    } catch (err) {
      if (selectedIdRef.current === sendingSessionId) {
        setError(err instanceof Error ? err.message : '发送失败')
      }
    } finally {
      if (selectedIdRef.current === sendingSessionId) refreshMessagesNowRef.current()
      setSending(false)
    }
  }, [
    clearPendingAttachments,
    draft,
    pendingAttachments,
    refreshSessionsNow,
    selectedId,
    sending,
    sessionMeta?.canSend,
  ])

  const handleCopyMessage = useCallback(
    (message: WechatDevMessage) => {
      void copyText(message.text, message.id)
    },
    [copyText]
  )

  if (loading) {
    return <LoadingConversation label='加载微信会话' />
  }

  const failedCount = status?.failedEventCount ?? 0
  const selectedSession = sessions.find((session) => session.id === selectedId) ?? sessionMeta

  return (
    <ChannelConversationShell
      banner={
        status?.lastError ? (
          <div className='border-t border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 sm:px-6'>
            <span className='font-medium'>{status.lastError.code}</span>
            <span className='mx-1.5 opacity-50'>·</span>
            {status.lastError.message}
          </div>
        ) : null
      }
      connected={Boolean(status?.connected)}
      headerExtra={
        failedCount > 0 ? (
          <Button
            danger
            disabled={retrying}
            ghost
            icon={<RotateCcw className='size-3.5' />}
            loading={retrying}
            size='small'
            onClick={() => void handleRetry()}
          >
            失败 {failedCount} · 重试
          </Button>
        ) : null
      }
      sessionCount={sessions.length}
      sidebar={
        <WechatSessionSidebar bound={bound} selectedId={selectedId} sessions={sessions} onSelect={setSelectedId} />
      }
      subtitle='Agent ↔ 微信用户'
      title='微信对话监控'
    >
      <WechatMessagePane
        copiedMessageId={copiedMessageId}
        draft={draft}
        error={error}
        fileInputRef={fileInputRef}
        loading={messagesLoading}
        maxOutboundFiles={MAX_OUTBOUND_FILES}
        messages={messages}
        pendingAttachments={pendingAttachments}
        perspective={perspective}
        sending={sending}
        sessionMeta={selectedSession}
        onCopy={handleCopyMessage}
        onDraftChange={setDraft}
        onExport={() => setExportOpen(true)}
        onPerspectiveToggle={() => setPerspective((prev) => (prev === 'agent' ? 'wechat' : 'agent'))}
        onPickFiles={handlePickFiles}
        onRemovePending={handleRemovePendingAttachment}
        onSend={() => void handleSend()}
      />

      {exportOpen && selectedSession ? (
        <ConversationExportDialog
          createExport={createWechatConversationExport}
          createFilename={createWechatExportFilename}
          exportMode='full'
          messages={messages}
          session={selectedSession}
          title='导出微信会话'
          onClose={() => setExportOpen(false)}
        />
      ) : null}
    </ChannelConversationShell>
  )
}
