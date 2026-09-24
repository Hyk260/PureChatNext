'use client'

import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ConversationExportDialog,
  LoadingConversation,
} from '@/features/dev/ConversationShared'
import { fetchQQStatus } from '@/features/settings/messenger/qqApi'
import type { QQStatus } from '@/features/settings/messenger/qqApi'

import { QqMessagePane } from './QqMessagePane'
import { QqSessionSidebar } from './QqSessionSidebar'
import {
  fetchQQSessionMessages,
  fetchQQSessions,
  sendQQMessage,
} from './qqConversationApi'
import type { QQMessage, QQSession } from './qqConversationApi'
import { createQQConversationExport, createQQExportFilename } from './qqConversationExport'
import {
  getActiveQQEventIds,
  hasActiveQQMessages,
  mergeQQMessages,
  MESSAGE_POLL_DELAYS,
  nextQQMessagePollDelay,
} from './qqConversationPolling'

const SESSION_POLL_MS = 30_000
const STATUS_POLL_MS = 30_000
const COPIED_FEEDBACK_MS = 1600

export default function QqConversationPage() {
  const [status, setStatus] = useState<QQStatus | null>(null)
  const [sessions, setSessions] = useState<QQSession[]>([])
  const [bound, setBound] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<QQMessage[]>([])
  const [sessionMeta, setSessionMeta] = useState<QQSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const messagesRef = useRef<QQMessage[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef<number>(MESSAGE_POLL_DELAYS[0])
  const refreshMessagesRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  const scheduleMessagePoll = useCallback(() => {
    clearMessageTimer()
    if (!selectedIdRef.current) return
    messageTimerRef.current = setTimeout(() => {
      void refreshMessagesRef.current()
    }, delayRef.current)
  }, [clearMessageTimer])

  const clearSelection = useCallback(() => {
    clearMessageTimer()
    selectedIdRef.current = null
    setSelectedId(null)
    setMessages([])
    setSessionMeta(null)
    setDraft('')
    setMessagesLoading(false)
  }, [clearMessageTimer])

  const refreshMessages = useCallback(async () => {
    const id = selectedIdRef.current
    if (!id) return
    try {
      const activeEventIds = getActiveQQEventIds(messagesRef.current)
      const data = await fetchQQSessionMessages(id, {
        limit: 50,
        watchEventIds: activeEventIds,
      })
      if (selectedIdRef.current !== id) return
      const merged = mergeQQMessages(messagesRef.current, data.messages)
      setMessages(merged.messages)
      setSessionMeta(data.session)
      delayRef.current = nextQQMessagePollDelay(delayRef.current, {
        changed: merged.changed,
        pending: hasActiveQQMessages(merged.messages),
      })
    } catch {
      /* 下一轮轮询继续重试 */
    } finally {
      if (selectedIdRef.current === id) scheduleMessagePoll()
    }
  }, [scheduleMessagePoll])

  useEffect(() => {
    refreshMessagesRef.current = refreshMessages
  }, [refreshMessages])

  const loadSession = useCallback(
    async (id: string) => {
      selectedIdRef.current = id
      setSelectedId(id)
      setMessages([])
      setSessionMeta(null)
      setDraft('')
      setMessagesLoading(true)
      setError(null)
      delayRef.current = MESSAGE_POLL_DELAYS[0]
      clearMessageTimer()
      try {
        const data = await fetchQQSessionMessages(id, 50)
        if (selectedIdRef.current !== id) return
        setMessages(data.messages)
        setSessionMeta(data.session)
        delayRef.current = nextQQMessagePollDelay(delayRef.current, {
          changed: true,
          pending: hasActiveQQMessages(data.messages),
        })
      } catch (err) {
        if (selectedIdRef.current !== id) return
        setError(err instanceof Error ? err.message : '消息加载失败')
      } finally {
        if (selectedIdRef.current === id) {
          setMessagesLoading(false)
          scheduleMessagePoll()
        }
      }
    },
    [clearMessageTimer, scheduleMessagePoll]
  )

  const refreshSessions = useCallback(async () => {
    try {
      const data = await fetchQQSessions()
      setBound(data.bound)
      setSessions(data.sessions)

      const current = selectedIdRef.current
      if (current && data.sessions.some((session) => session.id === current)) return

      const first = data.sessions[0]?.id ?? null
      if (first) {
        void loadSession(first)
      } else {
        clearSelection()
      }
    } catch {
      /* 会话轮询静默重试 */
    }
  }, [clearSelection, loadSession])

  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      try {
        const [qqStatus, sessionData] = await Promise.all([fetchQQStatus(), fetchQQSessions()])
        if (!active) return
        setStatus(qqStatus)
        setBound(sessionData.bound)
        setSessions(sessionData.sessions)
        const first = sessionData.sessions[0]?.id ?? null
        if (first) {
          void loadSession(first)
        } else {
          clearSelection()
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (active) setLoading(false)
      }
    }
    void bootstrap()

    const statusTimer = setInterval(() => {
      void fetchQQStatus()
        .then(setStatus)
        .catch(() => {})
    }, STATUS_POLL_MS)
    const sessionTimer = setInterval(() => {
      void refreshSessions()
    }, SESSION_POLL_MS)

    return () => {
      active = false
      clearInterval(statusTimer)
      clearInterval(sessionTimer)
      clearMessageTimer()
    }
  }, [clearMessageTimer, clearSelection, loadSession, refreshSessions])

  const send = async () => {
    if (!selectedId || !sessionMeta?.canSend || !draft.trim() || sending) return
    setSending(true)
    try {
      const message = await sendQQMessage(selectedId, draft)
      if (selectedIdRef.current !== selectedId) return
      setMessages((current) => mergeQQMessages(current, [message]).messages)
      setDraft('')
    } catch (err) {
      if (selectedIdRef.current === selectedId) {
        setError(err instanceof Error ? err.message : '发送失败')
      }
    } finally {
      if (selectedIdRef.current === selectedId) setSending(false)
    }
  }

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(id)
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === id ? null : current))
      }, COPIED_FEEDBACK_MS)
    } catch {
      setError('复制失败，请检查浏览器剪贴板权限')
    }
  }

  if (loading) {
    return <LoadingConversation label='加载 QQ 会话' />
  }

  const connected = Boolean(status?.connected)

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <header className='shrink-0 border-b border-border bg-card/90 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6'>
          <div className='flex items-center gap-2'>
            <div className='flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20'>
              <MessageSquare className='size-4' />
            </div>
            <div>
              <h1 className='text-sm font-semibold tracking-tight'>QQ 对话监控</h1>
              <p className='text-[11px] text-muted-foreground'>Agent ↔ QQ 用户</p>
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
          <span className='ml-auto text-[11px] text-muted-foreground'>会话 {sessions.length}</span>
        </div>
      </header>

      <div className='mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 overflow-hidden'>
        <QqSessionSidebar
          bound={bound}
          selectedId={selectedId}
          sessions={sessions}
          onSelect={(id) => void loadSession(id)}
        />
        <QqMessagePane
          copiedMessageId={copiedMessageId}
          draft={draft}
          error={error}
          loading={messagesLoading}
          messages={messages}
          sending={sending}
          sessionMeta={sessionMeta}
          onCopy={copyText}
          onDraftChange={setDraft}
          onExport={() => setExportOpen(true)}
          onSend={() => void send()}
        />
      </div>

      {exportOpen && sessionMeta ? (
        <ConversationExportDialog
          createExport={createQQConversationExport}
          createFilename={createQQExportFilename}
          exportMode='full'
          messages={messages}
          onClose={() => setExportOpen(false)}
          session={sessionMeta}
          title='导出 QQ 会话'
        />
      ) : null}
    </main>
  )
}
