'use client'

import {
  Bot,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
  User,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDateTime, formatSize } from '@pure/utils/client'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import {
  fetchQQDevSessionMessages,
  fetchQQDevSessions,
  sendQQDevMessage,
} from '@/features/dev/qqConversationApi'
import type { QQDevMessage, QQDevSession } from '@/features/dev/qqConversationApi'
import { createQQConversationExport, createQQExportFilename } from '@/features/dev/qqConversationExport'
import type { QQExportMode } from '@/features/dev/qqConversationExport'
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

function statusChip(status?: string) {
  if (!status || status === 'completed') return null
  const label: Record<string, string> = {
    canceled: '已取消',
    failed: '失败',
    pending: '排队',
    processing: '处理中',
    retry: '重试',
  }
  const color: Record<string, string> = {
    canceled: 'bg-slate-100 text-slate-600',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    pending: 'bg-sky-50 text-sky-700 ring-sky-200',
    processing: 'bg-amber-50 text-amber-700 ring-amber-200',
    retry: 'bg-orange-50 text-orange-700 ring-orange-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${color[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label[status] ?? status}
    </span>
  )
}

function ExportDialog({
  messages,
  onClose,
  session,
}: {
  messages: QQDevMessage[]
  onClose: () => void
  session: QQDevSession
}) {
  const [mode, setMode] = useState<QQExportMode>('full')
  const [feedback, setFeedback] = useState<string | null>(null)
  const content = useMemo(
    () => JSON.stringify(createQQConversationExport(mode, messages, session), null, 2),
    [messages, mode, session]
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setFeedback('JSON 已复制')
    } catch {
      setFeedback('复制失败，请手动复制预览内容')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.download = createQQExportFilename(session)
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm'>
      <div className='flex max-h-[min(760px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'>
        <div className='flex items-center gap-3 border-b border-slate-100 px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <h2 className='text-base font-semibold'>导出 QQ 会话</h2>
            <p className='mt-0.5 truncate text-xs text-slate-500'>仅包含当前页面已加载的消息</p>
          </div>
          <button className='rounded-lg p-2 text-slate-400 hover:bg-slate-100' type='button' onClick={onClose}>
            <X className='size-4' />
          </button>
        </div>
        <div className='flex gap-1 border-b border-slate-100 bg-slate-50 px-5 py-3'>
          {(
            [
              ['full', '完整 JSON'],
              ['openai', 'OpenAI 兼容'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === value ? 'bg-white text-slate-900 ring-1 ring-slate-200' : 'text-slate-500'}`}
              type='button'
              onClick={() => {
                setMode(value)
                setFeedback(null)
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <pre className='min-h-0 flex-1 overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-200'>{content}</pre>
        <div className='flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4'>
          {feedback ? <span className='mr-auto text-xs text-slate-500'>{feedback}</span> : null}
          <button className='rounded-lg px-3 py-2 text-xs ring-1 ring-slate-200' type='button' onClick={copy}>
            <Copy className='mr-1 inline size-3.5' />
            复制 JSON
          </button>
          <button className='rounded-lg bg-slate-900 px-3 py-2 text-xs text-white' type='button' onClick={download}>
            <Download className='mr-1 inline size-3.5' />
            下载文件
          </button>
        </div>
      </div>
    </div>
  )
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
    return (
      <div className='flex h-screen items-center justify-center bg-slate-50 text-slate-500'>
        <Loader2 className='mr-2 size-4 animate-spin' />
        加载 QQ 会话
      </div>
    )
  }

  const connected = Boolean(status?.connected)

  return (
    <div className='flex h-screen bg-slate-50 text-slate-900'>
      <aside className='flex w-[320px] flex-col border-r border-slate-200 bg-white'>
        <div className='flex items-center gap-2 border-b border-slate-100 px-4 py-4'>
          <div className='min-w-0 flex-1'>
            <h1 className='text-sm font-semibold'>QQ 对话</h1>
            <div className='mt-1 flex items-center gap-1.5 text-xs text-slate-500'>
              {connected ? <Wifi className='size-3.5 text-emerald-500' /> : <WifiOff className='size-3.5 text-rose-500' />}
              {connected ? '已连接' : '未连接'}
            </div>
          </div>
        </div>
        <div className='min-h-0 flex-1 overflow-auto p-2'>
          {sessions.length === 0 ? (
            <div className='flex flex-col items-center gap-3 px-6 py-14 text-center text-slate-400'>
              <MessageSquare className='size-8' />
              <p className='text-sm'>{bound ? '暂无会话' : '尚未绑定 QQ'}</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={`mb-1 flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left ${
                  session.id === selectedId ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
                type='button'
                onClick={() => void loadSession(session.id)}
              >
                <div className='flex items-center gap-2'>
                  <User className='size-3.5 shrink-0 opacity-60' />
                  <span className='min-w-0 flex-1 truncate text-xs font-medium'>
                    {session.externalUserName || truncateId(session.externalUserId, 10, 6)}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2 text-[10px] text-slate-400'>
                  <span className='truncate'>{session.agentTitle ?? session.agentId}</span>
                  <span>{formatDateTime(session.lastActiveAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className='flex min-w-0 flex-1 flex-col'>
        <div className='flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3'>
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
          <div className='flex items-end gap-2 border-t border-slate-200 bg-white p-3'>
            <textarea
              className='min-h-[52px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500'
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
              className='rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40'
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
        <ExportDialog messages={messages} onClose={() => setExportOpen(false)} session={sessionMeta} />
      ) : null}
    </div>
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
    <div className='min-h-0 flex-1 overflow-auto px-4 py-4' ref={scrollRef}>
      {messages.map((message) => {
        const isUser = message.role === 'user'
        return (
          <div key={message.id} className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] ${isUser ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'} rounded-2xl px-3.5 py-2.5`}>
              <div className='mb-1 flex items-center gap-2 text-[10px] text-slate-400'>
                {isUser ? <User className='size-3' /> : <Bot className='size-3' />}
                {formatDateTime(message.createdAt)}
                {statusChip(message.status)}
                <button
                  className='ml-auto text-slate-400 hover:text-slate-600'
                  type='button'
                  onClick={() => void onCopy(message.text, message.id)}
                >
                  {copiedMessageId === message.id ? <Check className='size-3' /> : <Copy className='size-3' />}
                </button>
              </div>
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
          </div>
        )
      })}
      <button className='mx-auto my-4 block text-xs text-slate-400 underline' type='button' onClick={onExport}>
        导出当前会话
      </button>
    </div>
  )
}
