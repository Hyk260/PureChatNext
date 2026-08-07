'use client'

import {
  AlertCircle,
  Bot,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Link2Off,
  Loader2,
  MessageSquare,
  Radio,
  RefreshCcw,
  RotateCcw,
  Send,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { formatDateTime, formatSize } from '@pure/utils/client'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import {
  fetchWechatDevSessionMessages,
  fetchWechatDevSessions,
  sendWechatDevMessage,
} from '@/features/dev/wechatConversationApi'
import type { WechatDevMessage, WechatDevSession } from '@/features/dev/wechatConversationApi'
import {
  getActiveWechatEventIds,
  hasActiveWechatMessages,
  mergeWechatDevMessages,
  MESSAGE_POLL_DELAYS,
  nextWechatMessagePollDelay,
} from '@/features/dev/wechatConversationPolling'
import { fetchWechatStatus, retryFailedWechatEvents } from '@/features/settings/messenger/wechatApi'
import type { WechatStatus } from '@/features/settings/messenger/wechatApi'

const STATUS_POLL_MS = 30_000
const SESSIONS_POLL_MS = 30_000

const STATUS_META: Record<
  string,
  { color: string; dot: string; label: string }
> = {
  degraded: { color: 'text-amber-700', dot: 'bg-amber-500', label: '降级' },
  needs_rebind: { color: 'text-rose-700', dot: 'bg-rose-500', label: '需重绑' },
  offline: { color: 'text-rose-700', dot: 'bg-rose-500', label: '离线' },
  online: { color: 'text-emerald-700', dot: 'bg-emerald-500', label: '在线' },
  starting: { color: 'text-sky-700', dot: 'bg-sky-500', label: '启动中' },
  stopped: { color: 'text-slate-500', dot: 'bg-slate-400', label: '已停止' },
}

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

function truncateId(id: string, head = 8, tail = 4) {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

function statusChip(status?: string) {
  if (!status || status === 'completed') return null
  const map: Record<string, string> = {
    canceled: 'bg-slate-100 text-slate-600',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    pending: 'bg-sky-50 text-sky-700 ring-sky-200',
    processing: 'bg-amber-50 text-amber-700 ring-amber-200',
    retry: 'bg-orange-50 text-orange-700 ring-orange-200',
  }
  const label: Record<string, string> = {
    canceled: '已取消',
    failed: '失败',
    pending: '排队',
    processing: '处理中',
    retry: '重试',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${map[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label[status] ?? status}
    </span>
  )
}

const KIND_LABEL: Record<string, string> = {
  command: '指令',
  unsupported: '不支持',
  image: '图片',
  file: '文件',
}

function kindChip(kind?: string) {
  if (!kind || kind === 'text' || kind === 'outbound') return null
  const label = KIND_LABEL[kind] ?? kind
  return (
    <span className='inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200'>
      {label}
    </span>
  )
}

function getAccessLabel(canSend: boolean, isOwnBinding?: boolean) {
  if (canSend) return '可代发'
  if (isOwnBinding) return '只读'
  return '其它账号'
}

function getAccessChipClass(canSend: boolean, active: boolean) {
  if (canSend) {
    return active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-50 text-emerald-700'
  }
  return active ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'
}

function getComposerPlaceholder(
  selectedId: string | null,
  canSend: boolean,
  isOwnBinding?: boolean,
) {
  if (!selectedId) return '先选择会话'
  if (canSend) return '以 Agent 身份发送文本…（Enter 发送，Shift+Enter 换行）'
  if (isOwnBinding) return '仅可向扫码授权的微信账号代发（当前会话只读）'
  return '其它账号的会话，仅可查看'
}

function getBubbleClass(isUser: boolean, hasMedia: boolean) {
  if (isUser && hasMedia) {
    return 'overflow-hidden rounded-br-md bg-transparent p-0 shadow-none'
  }
  if (isUser) {
    return 'rounded-br-md bg-slate-900 px-3.5 py-2.5 text-white'
  }
  return 'rounded-bl-md bg-slate-50 px-3.5 py-2.5 text-slate-800 ring-1 ring-slate-200/80'
}

type FileVisual = {
  Icon: LucideIcon
  iconClass: string
  wrapClass: string
}

function fileVisual(fileName?: string): FileVisual {
  const ext = (fileName?.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') {
    return { Icon: FileText, iconClass: 'text-rose-600', wrapClass: 'bg-rose-50 ring-rose-200' }
  }
  if (['doc', 'docx'].includes(ext)) {
    return { Icon: FileText, iconClass: 'text-sky-600', wrapClass: 'bg-sky-50 ring-sky-200' }
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { Icon: FileSpreadsheet, iconClass: 'text-emerald-600', wrapClass: 'bg-emerald-50 ring-emerald-200' }
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { Icon: FileText, iconClass: 'text-orange-600', wrapClass: 'bg-orange-50 ring-orange-200' }
  }
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) {
    return { Icon: FileArchive, iconClass: 'text-amber-600', wrapClass: 'bg-amber-50 ring-amber-200' }
  }
  if (['md', 'txt', 'json', 'xml', 'yml', 'yaml', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'].includes(ext)) {
    return { Icon: FileCode, iconClass: 'text-slate-600', wrapClass: 'bg-slate-100 ring-slate-200' }
  }
  return { Icon: File, iconClass: 'text-slate-500', wrapClass: 'bg-slate-50 ring-slate-200' }
}

function FileMessageCard({ fileName, fileSize, fileUrl }: { fileName?: string; fileSize?: number | null; fileUrl?: string }) {
  const { Icon, iconClass, wrapClass } = fileVisual(fileName)
  const name = fileName || '未命名文件'
  const sizeLabel = typeof fileSize === 'number' ? formatSize(fileSize) : null
  const inner = (
    <div className='flex min-w-[220px] max-w-[320px] items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200'>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${wrapClass}`}>
        <Icon className={`size-5 ${iconClass}`} />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium text-slate-900' title={name}>
          {name}
        </div>
        <div className='mt-0.5 text-[11px] text-slate-500'>{sizeLabel ?? '未知大小'}</div>
      </div>
    </div>
  )
  if (!fileUrl) return inner
  return (
    <a className='block transition hover:opacity-90' download href={fileUrl} rel='noreferrer'>
      {inner}
    </a>
  )
}

function renderSessionListBody({
  bound,
  loading,
  onSelect,
  selectedId,
  sessions,
}: {
  bound: boolean
  loading: boolean
  onSelect: (id: string) => void
  selectedId: string | null
  sessions: WechatDevSession[]
}): ReactNode {
  if (loading) {
    return (
      <div className='flex items-center justify-center gap-2 py-16 text-sm text-slate-400'>
        <Loader2 className='size-4 animate-spin' />
        加载中
      </div>
    )
  }

  if (sessions.length === 0 && !bound) {
    return (
      <div className='flex flex-col items-center gap-3 px-6 py-14 text-center'>
        <Link2Off className='size-8 text-slate-300' />
        <p className='text-sm text-slate-500'>尚未绑定微信</p>
        <Link
          className='text-xs font-medium text-emerald-700 underline-offset-2 hover:underline'
          to='/settings/messenger/wechat'
        >
          前往扫码绑定
        </Link>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 px-6 py-14 text-center'>
        <MessageSquare className='size-8 text-slate-300' />
        <p className='text-sm text-slate-500'>暂无会话</p>
        <p className='text-xs text-slate-400'>用微信给 Bot 发一条消息后会出现在这里</p>
      </div>
    )
  }

  return (
    <ul className='p-2'>
      {sessions.map((session) => {
        const active = session.id === selectedId
        const accessLabel = getAccessLabel(session.canSend, session.isOwnBinding)
        return (
          <li key={session.id}>
            <button
              className={`flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition ${
                active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
              }`}
              type='button'
              onClick={() => onSelect(session.id)}
            >
              <div className='flex items-center gap-2'>
                <User className={`size-3.5 shrink-0 ${active ? 'text-slate-300' : 'text-slate-400'}`} />
                <span className='min-w-0 flex-1 truncate text-xs font-medium'>
                  {session.externalUserName || truncateId(session.externalUserId, 10, 6)}
                </span>
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${getAccessChipClass(session.canSend, active)}`}
                >
                  {accessLabel}
                </span>
              </div>
              <div className='flex items-center justify-between gap-2 text-[10px] text-slate-400'>
                <span className='truncate'>{session.agentTitle ?? session.agentId}</span>
                <span className='shrink-0'>{formatDateTime(session.lastActiveAt)}</span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
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
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<WechatDevMessage[]>([])
  const pauseMessagesRef = useRef<() => void>(() => {})
  const refreshMessagesNowRef = useRef<() => void>(() => {})
  const selectedIdRef = useRef(selectedId)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const refreshStatus = useCallback(async (signal?: AbortSignal) => {
    const st = await fetchWechatStatus(signal)
    setStatus(st)
    return st
  }, [])

  const refreshSessions = useCallback(async (signal?: AbortSignal) => {
    const data = await fetchWechatDevSessions(signal)
    setBound(data.bound)
    setSessions(data.sessions)
    setSelectedId((prev) => {
      if (prev && data.sessions.some((s) => s.id === prev)) return prev
      return data.sessions[0]?.id ?? null
    })
    return data
  }, [])

  const bootstrap = useCallback(async (signal: AbortSignal) => {
    try {
      await Promise.all([refreshStatus(signal), refreshSessions(signal)])
    } catch (err) {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [refreshSessions, refreshStatus])

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
      if (active) setDraft('')
    })
    return () => {
      active = false
    }
  }, [selectedId])

  const selectedConversationVersion = sessions.find((session) => session.id === selectedId)?.conversationVersion

  // Selected-session messages use a non-overlapping, visibility-aware adaptive delta loop.
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
        setLastSyncedAt(new Date().toISOString())
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

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? sessionMeta
  const externalUserLabel = selectedSession?.externalUserName || selectedSession?.externalUserId || '微信用户'
  const canSend = Boolean(selectedSession?.canSend)

  const handleSend = useCallback(async () => {
    if (!selectedId || sending || !canSend) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError(null)
    const sendingSessionId = selectedId
    pauseMessagesRef.current()
    try {
      const message = await sendWechatDevMessage(sendingSessionId, text)
      if (selectedIdRef.current === sendingSessionId) {
        const merged = mergeWechatDevMessages(messagesRef.current, [message])
        messagesRef.current = merged.messages
        setMessages(merged.messages)
      }
      if (selectedIdRef.current === sendingSessionId) setDraft('')
      refreshSessionsNow()
    } catch (err) {
      if (selectedIdRef.current === sendingSessionId) {
        setError(err instanceof Error ? err.message : '发送失败')
      }
    } finally {
      if (selectedIdRef.current === sendingSessionId) refreshMessagesNowRef.current()
      setSending(false)
    }
  }, [canSend, draft, refreshSessionsNow, selectedId, sending])

  const runtimeKey = status?.runtimeStatus ?? 'stopped'
  const runtimeMeta = STATUS_META[runtimeKey] ?? STATUS_META.stopped
  const messageSig = useMemo(() => messages.map((m) => m.id).join('|'), [messages])

  const { handleScroll, ref: scrollRef } = useAutoScroll<HTMLDivElement>({
    deps: [messageSig, selectedId],
    enabled: Boolean(selectedId),
  })

  return (
    <main className='flex h-screen flex-col bg-[#f0f2f5] text-slate-900'>
      {/* Status bar */}
      <header className='shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6'>
          <div className='mr-2 flex items-center gap-2'>
            <div className='flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'>
              <Radio className='size-4' />
            </div>
            <div>
              <h1 className='text-sm font-semibold tracking-tight'>微信对话监控</h1>
              <p className='text-[11px] text-slate-500'>Agent ↔ 微信用户 · Dev</p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium ring-1 ring-slate-200 ${runtimeMeta.color}`}
            >
              <span className={`size-1.5 rounded-full ${runtimeMeta.dot}`} />
              Gateway {runtimeMeta.label}
            </span>

            <span className='inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200'>
              {status?.connected ? (
                <Wifi className='size-3 text-emerald-600' />
              ) : (
                <WifiOff className='size-3 text-slate-400' />
              )}
              {status?.connected ? '已连接' : '未连接'}
            </span>

            <span className='inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200'>
              {status?.gatewaySupported === false ? 'Gateway 未启用' : 'Gateway 已启用'}
            </span>

            {(status?.failedEventCount ?? 0) > 0 ? (
              <span className='inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200'>
                <AlertCircle className='size-3' />
                失败 {status?.failedEventCount}
              </span>
            ) : null}
          </div>

          <div className='ml-auto flex flex-wrap items-center gap-2 text-[11px] text-slate-500'>
            <span>心跳 {formatDateTime(status?.lastHeartbeatAt)}</span>
            <span className='hidden sm:inline'>·</span>
            <span className='hidden sm:inline'>活跃 {formatDateTime(status?.lastActiveAt)}</span>
            {lastSyncedAt ? (
              <>
                <span>·</span>
                <span>同步 {formatDateTime(lastSyncedAt)}</span>
              </>
            ) : null}
            <button
              className='inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50'
              disabled={loading}
              type='button'
              onClick={() => {
                refreshStatusNow()
                refreshSessionsNow()
                refreshMessagesNowRef.current()
              }}
            >
              <RefreshCcw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            {(status?.failedEventCount ?? 0) > 0 ? (
              <button
                className='inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:opacity-50'
                disabled={retrying}
                type='button'
                onClick={() => void handleRetry()}
              >
                {retrying ? <Loader2 className='size-3 animate-spin' /> : <RotateCcw className='size-3' />}
                重试失败
              </button>
            ) : null}
          </div>
        </div>

        {status?.lastError ? (
          <div className='border-t border-amber-100 bg-amber-50/80 px-4 py-2 text-xs text-amber-800 sm:px-6'>
            <span className='font-medium'>{status.lastError.code}</span>
            <span className='mx-1.5 text-amber-400'>·</span>
            {status.lastError.message}
          </div>
        ) : null}
        {error ? (
          <div className='border-t border-rose-100 bg-rose-50/80 px-4 py-2 text-xs text-rose-700 sm:px-6'>
            {error}
          </div>
        ) : null}
      </header>

      <div className='mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-0 overflow-hidden px-0 sm:gap-3 sm:px-4 sm:py-3 lg:px-6'>
        {/* Session list */}
        <aside className='flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white sm:rounded-2xl sm:border'>
          <div className='flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3'>
            <span className='text-xs font-semibold uppercase tracking-wider text-slate-500'>会话</span>
            <span className='rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600'>
              {sessions.length}
            </span>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto'>
            {renderSessionListBody({
              bound,
              loading,
              onSelect: setSelectedId,
              selectedId,
              sessions,
            })}
          </div>
        </aside>

        {/* Chat panel */}
        <section className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-slate-200/80'>
          {selectedSession ? (
            <div className='flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3'>
              <div className='flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600'>
                <User className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <div className='truncate text-sm font-semibold'>
                    {selectedSession.externalUserName || selectedSession.externalUserId}
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      canSend ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {getAccessLabel(canSend, selectedSession.isOwnBinding)}
                  </span>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-[11px] text-slate-500'>
                  <span className='truncate font-mono'>{selectedSession.externalUserId}</span>
                  <span>·</span>
                  <span className='inline-flex items-center gap-1'>
                    <Bot className='size-3' />
                    {selectedSession.agentTitle ?? selectedSession.agentId}
                  </span>
                  <span>·</span>
                  <span>v{selectedSession.conversationVersion}</span>
                  {messagesLoading ? (
                    <>
                      <span>·</span>
                      <Loader2 className='size-3 animate-spin' />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className='flex shrink-0 items-center border-b border-slate-100 px-4 py-3 text-sm text-slate-400'>
              选择左侧会话查看对话
            </div>
          )}

          <div
            ref={scrollRef}
            className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6'
            onScroll={handleScroll}
          >
            {!selectedId ? (
              <div className='flex h-full flex-col items-center justify-center gap-3 text-slate-400'>
                <MessageSquare className='size-10 opacity-40' />
                <p className='text-sm'>从左侧选择一个微信联系人</p>
              </div>
            ) : messages.length === 0 ? (
              <div className='flex h-full flex-col items-center justify-center gap-2 text-slate-400'>
                <p className='text-sm'>当前对话版本暂无消息</p>
                <p className='text-xs'>发送消息或切换 /new 后会显示在这里</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user'
                const hasMedia = Boolean(msg.imageUrl || msg.fileUrl)
                let content: ReactNode
                if (isUser && msg.imageUrl) {
                  content = (
                    <a
                      className='block overflow-hidden rounded-2xl rounded-br-md bg-white p-1 ring-1 ring-slate-200'
                      href={msg.imageUrl}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {/* Auth-gated same-origin proxy; next/image is a poor fit here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt='微信图片'
                        className='max-h-80 max-w-full rounded-xl object-contain'
                        loading='lazy'
                        src={msg.imageUrl}
                      />
                    </a>
                  )
                } else if (isUser && msg.fileUrl) {
                  content = (
                    <FileMessageCard fileName={msg.fileName} fileSize={msg.fileSize} fileUrl={msg.fileUrl} />
                  )
                } else if (isUser) {
                  content = <div className='whitespace-pre-wrap wrap-break-word'>{msg.text}</div>
                } else {
                  content = (
                    <MessageMarkdown className='wechat-dev-md prose prose-sm max-w-none prose-slate' text={msg.text} />
                  )
                }
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className='flex items-center gap-1.5 px-1'>
                      {isUser ? (
                        <User className='size-3 text-slate-400' />
                      ) : (
                        <Bot className='size-3 text-emerald-600' />
                      )}
                      <span className='text-[10px] font-medium text-slate-400'>
                        {isUser ? externalUserLabel : 'Agent'}
                      </span>
                      {kindChip(msg.messageKind)}
                      {statusChip(msg.status)}
                      <span className='text-[10px] text-slate-300'>{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <div
                      className={`max-w-[min(720px,92%)] rounded-2xl text-sm leading-relaxed shadow-sm ${getBubbleClass(isUser, hasMedia)}`}
                    >
                      {content}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className='shrink-0 border-t border-slate-100 px-4 py-3 sm:px-6'>
            <div className='flex items-end gap-2'>
              <textarea
                className='min-h-[44px] max-h-36 flex-1 resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-slate-300 disabled:opacity-50'
                disabled={!selectedId || sending || !canSend}
                placeholder={getComposerPlaceholder(selectedId, canSend, selectedSession?.isOwnBinding)}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
              />
              <button
                className='inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50'
                disabled={!selectedId || sending || !canSend || !draft.trim()}
                type='button'
                onClick={() => void handleSend()}
              >
                {sending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
                发送
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
