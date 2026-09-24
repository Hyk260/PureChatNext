'use client'

import { AlertCircle, Loader2, MessageSquare, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ConversationExportDialog } from '@/features/dev/ConversationShared'
import { fetchWechatStatus, retryFailedWechatEvents } from '@/features/settings/messenger/wechatApi'
import type { WechatStatus } from '@/features/settings/messenger/wechatApi'

import { WechatMessagePane } from './WechatMessagePane'
import type { ChatPerspective, PendingAttachment } from './WechatMessagePane'
import { WechatSessionSidebar } from './WechatSessionSidebar'
import {
  fetchWechatDevSessionMessages,
  fetchWechatDevSessions,
  sendWechatDevMessage,
} from './wechatConversationApi'
import type { WechatDevMessage, WechatDevSession } from './wechatConversationApi'
import { createWechatConversationExport, createWechatExportFilename } from './wechatConversationExport'
import {
  getActiveWechatEventIds,
  hasActiveWechatMessages,
  mergeWechatDevMessages,
  MESSAGE_POLL_DELAYS,
  nextWechatMessagePollDelay,
} from './wechatConversationPolling'

const STATUS_POLL_MS = 30_000
const SESSIONS_POLL_MS = 30_000
const MAX_OUTBOUND_FILES = 5
const MAX_OUTBOUND_FILE_BYTES = 10 * 1024 * 1024
const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp|bmp)$/i
const COPIED_FEEDBACK_MS = 1600

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function isImageFileName(fileName?: string, mimeType?: string) {
  if (mimeType?.startsWith('image/')) return true
  return IMAGE_FILE_RE.test(fileName || '')
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const messagesRef = useRef<WechatDevMessage[]>([])
  const pauseMessagesRef = useRef<() => void>(() => {})
  const refreshMessagesNowRef = useRef<() => void>(() => {})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingRequestIdRef = useRef<string | null>(null)
  const selectedIdRef = useRef(selectedId)
  const pendingAttachmentsRef = useRef(pendingAttachments)

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
    STATUS_POLL_MS,
    !loading
  )
  const refreshSessionsNow = useVisiblePeriodicRefresh(
    async (signal) => {
      await refreshSessions(signal).catch(() => {})
    },
    SESSIONS_POLL_MS,
    !loading
  )

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) {
        setDraft('')
        setExportOpen(false)
        setCopiedMessageId(null)
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
                watchEventIds: getActiveWechatEventIds(messagesRef.current),
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

        const merged = mergeWechatDevMessages(initial ? [] : messagesRef.current, data.messages)
        messagesRef.current = merged.messages
        setMessages(merged.messages)
        setSessionMeta(data.session)
        setError(null)
        cursor = data.cursor ?? cursor
        conversationVersion = data.session.conversationVersion
        delay = initial
          ? MESSAGE_POLL_DELAYS[0]
          : nextWechatMessagePollDelay(delay, {
              changed: merged.changed,
              pending: hasActiveWechatMessages(merged.messages),
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
        previewUrl: isImageFileName(file.name, file.type) ? URL.createObjectURL(file) : null,
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
        const merged = mergeWechatDevMessages(messagesRef.current, [message])
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
  }, [clearPendingAttachments, draft, pendingAttachments, refreshSessionsNow, selectedId, sending, sessionMeta?.canSend])

  const handleCopyMessage = useCallback(async (message: WechatDevMessage) => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopiedMessageId(message.id)
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current))
      }, COPIED_FEEDBACK_MS)
    } catch {
      setError('复制失败，请检查浏览器剪贴板权限')
    }
  }, [])

  if (loading) {
    return (
      <div className='flex h-full min-h-0 items-center justify-center bg-background text-muted-foreground'>
        <Loader2 className='mr-2 size-4 animate-spin' />
        加载微信会话
      </div>
    )
  }

  const connected = Boolean(status?.connected)
  const failedCount = status?.failedEventCount ?? 0
  const selectedSession = sessions.find((session) => session.id === selectedId) ?? sessionMeta

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <header className='shrink-0 border-b border-border bg-card/90 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6'>
          <div className='flex items-center gap-2'>
            <div className='flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20'>
              <MessageSquare className='size-4' />
            </div>
            <div>
              <h1 className='text-sm font-semibold tracking-tight'>微信对话监控</h1>
              <p className='text-[11px] text-muted-foreground'>Agent ↔ 微信用户</p>
            </div>
          </div>
          <span
            className={`ml-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium ring-1 ring-border ${
              connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
            }`}
          >
            <span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-destructive'}`} />
            {connected ? '已连接' : '未连接'}
          </span>
          {failedCount > 0 ? (
            <button
              className='inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/20 disabled:opacity-50'
              disabled={retrying}
              type='button'
              onClick={() => void handleRetry()}
            >
              {retrying ? <Loader2 className='size-3 animate-spin' /> : <AlertCircle className='size-3' />}
              失败 {failedCount}
              <RotateCcw className='size-3' />
              重试
            </button>
          ) : null}
          <span className='ml-auto text-[11px] text-muted-foreground'>会话 {sessions.length}</span>
        </div>
        {status?.lastError ? (
          <div className='border-t border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 sm:px-6'>
            <span className='font-medium'>{status.lastError.code}</span>
            <span className='mx-1.5 opacity-50'>·</span>
            {status.lastError.message}
          </div>
        ) : null}
      </header>

      <div className='mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 overflow-hidden'>
        <WechatSessionSidebar
          bound={bound}
          selectedId={selectedId}
          sessions={sessions}
          onSelect={setSelectedId}
        />
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
          onCopy={(message) => void handleCopyMessage(message)}
          onDraftChange={setDraft}
          onExport={() => setExportOpen(true)}
          onPerspectiveToggle={() => setPerspective((prev) => (prev === 'agent' ? 'wechat' : 'agent'))}
          onPickFiles={handlePickFiles}
          onRemovePending={handleRemovePendingAttachment}
          onSend={() => void handleSend()}
        />
      </div>

      {exportOpen && selectedSession ? (
        <ConversationExportDialog
          createExport={createWechatConversationExport}
          createFilename={createWechatExportFilename}
          exportMode='full'
          messages={messages}
          onClose={() => setExportOpen(false)}
          session={selectedSession}
          title='导出微信会话'
        />
      ) : null}
    </main>
  )
}
