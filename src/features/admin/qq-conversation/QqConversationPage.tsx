'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CHANNEL_SESSION_POLL_MS,
  CHANNEL_STATUS_POLL_MS,
  ChannelConversationShell,
  ConversationExportDialog,
  LoadingConversation,
  getActiveChannelEventIds,
  hasActiveChannelMessages,
  mergeChannelMessages,
  MESSAGE_POLL_DELAYS,
  nextChannelMessagePollDelay,
  useCopyFeedback,
} from '@/features/admin/channel-conversation'
import { fetchQQStatus } from '@/features/settings/messenger/qqApi'
import type { QQStatus } from '@/features/settings/messenger/qqApi'

import { QqMessagePane } from './QqMessagePane'
import type { PendingAttachment } from './QqMessagePane'
import { QqSessionSidebar } from './QqSessionSidebar'
import { fetchQQSessionMessages, fetchQQSessions, sendQQMessage } from './qqConversationApi'
import type { QQMessage, QQSession } from './qqConversationApi'
import { createQQConversationExport, createQQExportFilename } from './qqConversationExport'
import { QQ_MAX_OUTBOUND_FILE_BYTES, QQ_MAX_OUTBOUND_FILES } from '@/libs/channels/qq/outboundLimits'
import { isChannelImageFileName } from '@/features/admin/channel-conversation'

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
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const messagesRef = useRef<QQMessage[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef<number>(MESSAGE_POLL_DELAYS[0])
  const refreshMessagesRef = useRef<() => Promise<void>>(async () => {})
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingAttachmentsRef = useRef(pendingAttachments)
  const pendingRequestIdRef = useRef<string | null>(null)

  const { copiedMessageId, copyText } = useCopyFeedback(setError)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      for (const item of prev) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
      return []
    })
  }, [])

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
    clearPendingAttachments()
    pendingRequestIdRef.current = null
    setMessagesLoading(false)
  }, [clearMessageTimer, clearPendingAttachments])

  const refreshMessages = useCallback(async () => {
    const id = selectedIdRef.current
    if (!id) return
    try {
      const activeEventIds = getActiveChannelEventIds(messagesRef.current)
      const data = await fetchQQSessionMessages(id, {
        limit: 50,
        watchEventIds: activeEventIds,
      })
      if (selectedIdRef.current !== id) return
      const merged = mergeChannelMessages(messagesRef.current, data.messages)
      setMessages(merged.messages)
      setSessionMeta(data.session)
      delayRef.current = nextChannelMessagePollDelay(delayRef.current, {
        changed: merged.changed,
        pending: hasActiveChannelMessages(merged.messages),
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
      clearPendingAttachments()
      pendingRequestIdRef.current = null
      setMessagesLoading(true)
      setError(null)
      delayRef.current = MESSAGE_POLL_DELAYS[0]
      clearMessageTimer()
      try {
        const data = await fetchQQSessionMessages(id, 50)
        if (selectedIdRef.current !== id) return
        setMessages(data.messages)
        setSessionMeta(data.session)
        delayRef.current = nextChannelMessagePollDelay(delayRef.current, {
          changed: true,
          pending: hasActiveChannelMessages(data.messages),
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
    [clearMessageTimer, clearPendingAttachments, scheduleMessagePoll]
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
    }, CHANNEL_STATUS_POLL_MS)
    const sessionTimer = setInterval(() => {
      void refreshSessions()
    }, CHANNEL_SESSION_POLL_MS)

    return () => {
      active = false
      clearInterval(statusTimer)
      clearInterval(sessionTimer)
      clearMessageTimer()
    }
  }, [clearMessageTimer, clearSelection, loadSession, refreshSessions])

  const handlePickFiles = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return
    const current = pendingAttachmentsRef.current
    pendingRequestIdRef.current = null
    const remaining = QQ_MAX_OUTBOUND_FILES - current.length
    if (remaining <= 0) {
      setError(`一次最多添加 ${QQ_MAX_OUTBOUND_FILES} 个附件`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const accepted: PendingAttachment[] = []
    let errorMessage: string | null = null
    for (const file of Array.from(fileList)) {
      if (accepted.length >= remaining) {
        errorMessage = `一次最多添加 ${QQ_MAX_OUTBOUND_FILES} 个附件`
        break
      }
      if (file.size <= 0) {
        errorMessage ??= `附件「${file.name}」为空`
        continue
      }
      if (file.size > QQ_MAX_OUTBOUND_FILE_BYTES) {
        errorMessage ??= `附件「${file.name}」超过 ${Math.round(QQ_MAX_OUTBOUND_FILE_BYTES / (1024 * 1024))}MB 限制`
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

  const send = async () => {
    if (!selectedId || !sessionMeta?.canSend || sending) return
    const text = draft.trim()
    const files = pendingAttachments.map((item) => item.file)
    if (!text && files.length === 0) return
    const requestId = pendingRequestIdRef.current ?? crypto.randomUUID()
    pendingRequestIdRef.current = requestId
    setSending(true)
    setError(null)
    const sendingSessionId = selectedId
    try {
      const message = await sendQQMessage(sendingSessionId, { files, requestId, text })
      if (selectedIdRef.current !== sendingSessionId) return
      setMessages((current) => mergeChannelMessages(current, [message]).messages)
      setDraft('')
      clearPendingAttachments()
      pendingRequestIdRef.current = null
    } catch (err) {
      if (selectedIdRef.current === sendingSessionId) {
        setError(err instanceof Error ? err.message : '发送失败')
      }
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    return () => {
      for (const item of pendingAttachmentsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

  if (loading) {
    return <LoadingConversation label='加载 QQ 会话' />
  }

  return (
    <ChannelConversationShell
      connected={Boolean(status?.connected)}
      sessionCount={sessions.length}
      sidebar={
        <QqSessionSidebar
          bound={bound}
          selectedId={selectedId}
          sessions={sessions}
          onSelect={(id) => void loadSession(id)}
        />
      }
      subtitle='Agent ↔ QQ 用户'
      title='QQ 对话监控'
    >
      <QqMessagePane
        copiedMessageId={copiedMessageId}
        draft={draft}
        error={error}
        fileInputRef={fileInputRef}
        loading={messagesLoading}
        maxOutboundFiles={QQ_MAX_OUTBOUND_FILES}
        messages={messages}
        pendingAttachments={pendingAttachments}
        sending={sending}
        sessionMeta={sessionMeta}
        onCopy={copyText}
        onDraftChange={setDraft}
        onExport={() => setExportOpen(true)}
        onPickFiles={handlePickFiles}
        onRemovePending={handleRemovePendingAttachment}
        onSend={() => void send()}
      />

      {exportOpen && sessionMeta ? (
        <ConversationExportDialog
          createExport={createQQConversationExport}
          createFilename={createQQExportFilename}
          exportMode='full'
          messages={messages}
          session={sessionMeta}
          title='导出 QQ 会话'
          onClose={() => setExportOpen(false)}
        />
      ) : null}
    </ChannelConversationShell>
  )
}
