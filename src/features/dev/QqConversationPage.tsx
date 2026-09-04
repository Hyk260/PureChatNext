'use client'

import {
  ArrowLeft,
  Bot,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatDateTime, formatSize } from '@pure/utils/client'
import { ActionIcon } from '@pure/ui'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import {
  ConversationExportDialog,
  CopyMessageButton,
  LoadingConversation,
  StatusChip,
} from '@/features/dev/ConversationShared'
import {
  fetchQQDevSessionMessages,
  fetchQQDevSessions,
  sendQQDevMessage,
} from '@/features/dev/qqConversationApi'
import type { QQDevMessage, QQDevSession } from '@/features/dev/qqConversationApi'
import { createQQConversationExport, createQQExportFilename } from '@/features/dev/qqConversationExport'
import {
  getActiveQQEventIds,
  hasActiveQQMessages,
  mergeQQDevMessages,
  MESSAGE_POLL_DELAYS,
  nextQQMessagePollDelay,
} from '@/features/dev/qqConversationPolling'
import { fetchQQStatus } from '@/features/settings/messenger/qqApi'
import type { QQStatus } from '@/features/settings/messenger/qqApi'

const SESSION_POLL_MS = 30_000
const STATUS_POLL_MS = 30_000

function truncateId(id: string, head = 8, tail = 4) {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

function AttachmentCard({ attachment }: { attachment: NonNullable<QQDevMessage['attachments']>[number] }) {
  const sizeLabel = typeof attachment.fileSize === 'number' ? formatSize(attachment.fileSize) : '未知大小'
  return (
    <a
      className='mt-2 flex max-w-[280px] items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 hover:opacity-90'
      href={attachment.fileUrl}
      rel='noreferrer'
      target='_blank'
    >
      <ExternalLink className='size-4 shrink-0 text-slate-400' />
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium text-slate-900'>{attachment.fileName}</div>
        <div className='mt-0.5 text-[11px] text-slate-500'>{sizeLabel}</div>
      </div>
    </a>
  )
}

export default function QqConversationPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<QQStatus | null>(null)
  const [sessions, setSessions] = useState<QQDevSession[]>([])
  const [bound, setBound] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<QQDevMessage[]>([])
  const [sessionMeta, setSessionMeta] = useState<QQDevSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const messagesRef = useRef<QQDevMessage[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef<number>(MESSAGE_POLL_DELAYS[0])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  const scheduleMessagePoll = useCallback(
    (task: () => Promise<void>) => {
      clearMessageTimer()
      if (!selectedIdRef.current) return
      messageTimerRef.current = setTimeout(() => {
        void task()
      }, delayRef.current)
    },
    [clearMessageTimer]
  )

  const refreshMessages = useCallback(async () => {
    const id = selectedIdRef.current
    if (!id) return
    try {
      const activeEventIds = getActiveQQEventIds(messagesRef.current)
      const data = await fetchQQDevSessionMessages(id, {
        limit: 50,
        watchEventIds: activeEventIds,
      })
      const merged = mergeQQDevMessages(messagesRef.current, data.messages)
      setMessages(merged.messages)
      setSessionMeta(data.session)
      delayRef.current = nextQQMessagePollDelay(delayRef.current, {
        changed: merged.changed,
        pending: hasActiveQQMessages(merged.messages),
      })
    } catch {
      /* 下一轮轮询继续重试 */
    } finally {
      scheduleMessagePoll(refreshMessages)
    }
  }, [scheduleMessagePoll])

  const loadSession = useCallback(
    async (id: string) => {
      setSelectedId(id)
      setMessages([])
      setSessionMeta(null)
      setDraft('')
      setMessagesLoading(true)
      setError(null)
      delayRef.current = MESSAGE_POLL_DELAYS[0]
      clearMessageTimer()
      try {
        const data = await fetchQQDevSessionMessages(id, 50)
        setMessages(data.messages)
        setSessionMeta(data.session)
        delayRef.current = nextQQMessagePollDelay(delayRef.current, {
          changed: true,
          pending: hasActiveQQMessages(data.messages),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '消息加载失败')
      } finally {
        setMessagesLoading(false)
        scheduleMessagePoll(refreshMessages)
      }
    },
    [clearMessageTimer, refreshMessages, scheduleMessagePoll]
  )

  const refreshSessions = useCallback(async () => {
    try {
      const data = await fetchQQDevSessions()
      setBound(data.bound)
      setSessions(data.sessions)
      setSelectedId((current) => {
        if (current && data.sessions.some((session) => session.id === current)) return current
        return data.sessions[0]?.id ?? null
      })
    } catch {
      /* 会话轮询静默重试 */
    }
  }, [])

  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      try {
        const [qqStatus, sessionData] = await Promise.all([fetchQQStatus(), fetchQQDevSessions()])
        if (!active) return
        setStatus(qqStatus)
        setBound(sessionData.bound)
        setSessions(sessionData.sessions)
        const first = sessionData.sessions[0]?.id ?? null
        setSelectedId(first)
        if (first) void loadSession(first)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (active) setLoading(false)
      }
    }
    void bootstrap()

    const statusTimer = setInterval(() => {
      void fetchQQStatus().then(setStatus).catch(() => {})
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
  }, [clearMessageTimer, loadSession, refreshSessions])

  useEffect(() => {
    return () => clearMessageTimer()
  }, [clearMessageTimer])

  const send = async () => {
    if (!selectedId || !draft.trim() || sending) return
    setSending(true)
    try {
      const message = await sendQQDevMessage(selectedId, draft)
      setMessages((current) => mergeQQDevMessages(current, [message]).messages)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedMessageId(id)
  }

  if (loading) {
    return <LoadingConversation label='加载 QQ 会话' />
  }

  const connected = Boolean(status?.connected)

  return (
    <main className='flex h-screen flex-col bg-[#f0f2f5] text-slate-900'>
      <header className='shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6'>
          <ActionIcon
            aria-label='返回上一页'
            icon={ArrowLeft}
            size='small'
            title='返回上一页'
            onClick={() => navigate(-1)}
          />
          <div className='flex items-center gap-2'>
            <div className='flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100'>
              <MessageSquare className='size-4' />
            </div>
            <div>
              <h1 className='text-sm font-semibold tracking-tight'>QQ 对话监控</h1>
              <p className='text-[11px] text-slate-500'>Agent ↔ QQ 用户 · Dev</p>
            </div>
          </div>
          <span className={`ml-2 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium ring-1 ring-slate-200 ${connected ? 'text-emerald-700' : 'text-rose-700'}`}>
            <span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {connected ? '已连接' : '未连接'}
          </span>
          <span className='ml-auto text-[11px] text-slate-500'>会话 {sessions.length}</span>
        </div>
      </header>

      <div className='mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-0 overflow-hidden px-0 sm:gap-3 sm:px-4 sm:py-3 lg:px-6'>
      <aside className='flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white sm:rounded-2xl sm:border'>
        <div className='flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3'>
          <span className='text-xs font-semibold uppercase tracking-wider text-slate-500'>会话</span>
          <span className='rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600'>{sessions.length}</span>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto p-2'>
          {sessions.length === 0 ? (
            <div className='flex flex-col items-center gap-3 px-6 py-14 text-center text-slate-400'>
              <MessageSquare className='size-8' />
              <p className='text-sm'>{bound ? '暂无会话' : '尚未绑定 QQ'}</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={`mb-1 flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition ${session.id === selectedId ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
                type='button'
                onClick={() => void loadSession(session.id)}
              >
                <div className='flex items-center gap-2'>
                  <User className='size-3.5 shrink-0 opacity-60' />
                  <span className='min-w-0 flex-1 truncate text-xs font-medium'>{session.externalUserName || truncateId(session.externalUserId, 10, 6)}</span>
                  <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${session.canSend ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{session.canSend ? '可代发' : '只读'}</span>
                </div>
                <div className='flex items-center justify-between gap-2 text-[10px] text-slate-400'>
                  <span className='truncate'>{session.agentTitle ?? session.agentId}</span>
                  <span className='shrink-0'>{formatDateTime(session.lastActiveAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-slate-200/80'>
        <div className='flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3'>
          <div className='min-w-0'>
            <div className='truncate text-sm font-semibold'>
              {sessionMeta?.externalUserName || truncateId(sessionMeta?.externalUserId ?? '', 12, 6) || '选择会话'}
            </div>
            <div className='text-xs text-slate-400'>
              {sessionMeta ? `会话版本 v${sessionMeta.conversationVersion} · ${sessionMeta.agentTitle ?? sessionMeta.agentId}` : '请在左侧选择会话'}
            </div>
          </div>
          {sessionMeta ? (
            <button
              className='rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-slate-200 hover:bg-slate-50'
              type='button'
              onClick={() => setExportOpen(true)}
            >
              <Download className='mr-1 inline size-3.5' />
              导出
            </button>
          ) : null}
        </div>

        {error ? (
          <div className='mx-4 mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700'>{error}</div>
        ) : null}

        <MessageList
          copiedMessageId={copiedMessageId}
          loading={messagesLoading}
          messages={messages}
          onCopy={copyText}
          onExport={() => setExportOpen(true)}
          sessionMeta={sessionMeta}
        />

        {sessionMeta ? (
          <div className='flex shrink-0 items-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-6'>
            <textarea
              className='min-h-[44px] flex-1 resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-slate-300'
              placeholder={sessionMeta.canSend ? '以 Agent 身份发送文字…' : '当前会话仅可查看'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <button
              className='inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50'
              disabled={!sessionMeta.canSend || !draft.trim() || sending}
              type='button'
              onClick={() => void send()}
            >
              {sending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            </button>
          </div>
        ) : null}
      </main>

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
    </div>
    </main>
  )
}

function MessageList({
  copiedMessageId,
  loading,
  messages,
  onCopy,
  onExport,
  sessionMeta,
}: {
  copiedMessageId: string | null
  loading: boolean
  messages: QQDevMessage[]
  onCopy: (text: string, id: string) => void
  onExport: () => void
  sessionMeta: QQDevSession | null
}) {
  const { ref: scrollRef } = useAutoScroll({
    deps: [messages],
    initialScrollToBottom: true,
  })

  if (loading) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center text-slate-400'>
        <Loader2 className='mr-2 size-4 animate-spin' />
        加载消息
      </div>
    )
  }

  if (!sessionMeta || messages.length === 0) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center text-slate-400'>
        暂无消息，等待 QQ 用户发送消息
      </div>
    )
  }

  return (
    <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6' ref={scrollRef}>
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const hasMedia = Boolean(message.fileUrl || message.attachments?.length)
        return (
          <div key={message.id} className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
            <div className='flex items-center gap-1.5 px-1'>
              {isUser ? <User className='size-3 text-slate-400' /> : <Bot className='size-3 text-sky-600' />}
              <span className='text-[10px] font-medium text-slate-400'>{isUser ? 'QQ 用户' : 'Agent'}</span>
              <StatusChip status={message.status} />
              <span className='text-[10px] text-slate-300'>{formatDateTime(message.createdAt)}</span>
            </div>
            <div className={`group flex max-w-[92%] items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[min(720px,100%)] rounded-2xl text-sm leading-relaxed shadow-sm ${isUser ? 'rounded-br-md bg-slate-900 px-3.5 py-2.5 text-white' : 'rounded-bl-md bg-slate-50 px-3.5 py-2.5 text-slate-800 ring-1 ring-slate-200/80'}`}>
              {isUser ? (
                <div className='whitespace-pre-wrap text-sm'>{message.text}</div>
              ) : (
                <MessageMarkdown text={message.text} />
              )}
              {message.attachments?.length ? (
                <div className='mt-2 space-y-2'>
                  {message.attachments.map((attachment) => (
                    <AttachmentCard key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              ) : null}
              {message.fileUrl && !message.attachments?.length ? (
                <AttachmentCard
                  attachment={{
                    deliveryStatus: 'available',
                    fileName: message.fileName || '附件',
                    fileSize: message.fileSize,
                    fileUrl: message.fileUrl,
                    id: message.id,
                    version: 1,
                  }}
                />
              ) : null}
              </div>
              {!hasMedia && message.text.trim() ? (
                <span className='mb-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100'>
                  <CopyMessageButton copied={copiedMessageId === message.id} onCopy={() => void onCopy(message.text, message.id)} />
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
      <button className='mx-auto my-4 block text-xs text-slate-400 underline' type='button' onClick={onExport}>
        导出当前会话
      </button>
    </div>
  )
}
