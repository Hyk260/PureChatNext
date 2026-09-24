'use client'

import { Bot, Download, ExternalLink, Loader2, Send, User } from 'lucide-react'
import { formatDateTime, formatSize } from '@pure/utils/client'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import { CopyMessageButton, StatusChip } from '@/features/dev/ConversationShared'

import type { QQAttachment, QQMessage, QQSession } from './qqConversationApi'
import { qqComposerPlaceholder, qqMessageUserLabel, qqSessionTitle } from './qqSessionLabels'

type QqMessagePaneProps = {
  copiedMessageId: string | null
  draft: string
  error: string | null
  loading: boolean
  messages: QQMessage[]
  onCopy: (text: string, id: string) => void
  onDraftChange: (value: string) => void
  onExport: () => void
  onSend: () => void
  sending: boolean
  sessionMeta: QQSession | null
}

function AttachmentCard({ attachment }: { attachment: QQAttachment }) {
  const sizeLabel = typeof attachment.fileSize === 'number' ? formatSize(attachment.fileSize) : '未知大小'
  return (
    <a
      className='mt-2 flex max-w-[280px] items-center gap-3 rounded-xl bg-background px-3 py-2.5 ring-1 ring-border hover:opacity-90'
      href={attachment.fileUrl}
      rel='noreferrer'
      target='_blank'
    >
      <ExternalLink className='size-4 shrink-0 text-muted-foreground' />
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium text-foreground'>{attachment.fileName}</div>
        <div className='mt-0.5 text-[11px] text-muted-foreground'>{sizeLabel}</div>
      </div>
    </a>
  )
}

function MessageList({
  copiedMessageId,
  loading,
  messages,
  onCopy,
  onExport,
  sessionMeta,
}: Pick<
  QqMessagePaneProps,
  'copiedMessageId' | 'loading' | 'messages' | 'onCopy' | 'onExport' | 'sessionMeta'
>) {
  const { handleScroll, ref: scrollRef } = useAutoScroll({
    deps: [messages],
    initialScrollToBottom: true,
  })

  if (loading) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center text-muted-foreground'>
        <Loader2 className='mr-2 size-4 animate-spin' />
        加载消息
      </div>
    )
  }

  if (!sessionMeta || messages.length === 0) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center text-muted-foreground'>
        暂无消息，等待 QQ 用户发送消息
      </div>
    )
  }

  return (
    <div
      className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6'
      ref={scrollRef}
      onScroll={handleScroll}
    >
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const hasMedia = Boolean(message.fileUrl || message.attachments?.length)
        return (
          <div key={message.id} className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
            <div className='flex items-center gap-1.5 px-1'>
              {isUser ? (
                <User className='size-3 text-muted-foreground' />
              ) : (
                <Bot className='size-3 text-primary' />
              )}
              <span className='text-[10px] font-medium text-muted-foreground'>
                {isUser ? qqMessageUserLabel(message, sessionMeta) : 'Agent'}
              </span>
              <StatusChip status={message.status} />
              <span className='text-[10px] text-muted-foreground/60'>{formatDateTime(message.createdAt)}</span>
            </div>
            <div className={`group flex max-w-[92%] items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div
                className={`max-w-[min(720px,100%)] rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? 'rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground'
                    : 'rounded-bl-md bg-muted px-3.5 py-2.5 text-foreground ring-1 ring-border'
                }`}
              >
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
                  <CopyMessageButton
                    copied={copiedMessageId === message.id}
                    onCopy={() => void onCopy(message.text, message.id)}
                  />
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
      <button
        className='mx-auto my-4 block text-xs text-muted-foreground underline'
        type='button'
        onClick={onExport}
      >
        导出当前会话
      </button>
    </div>
  )
}

export function QqMessagePane({
  copiedMessageId,
  draft,
  error,
  loading,
  messages,
  onCopy,
  onDraftChange,
  onExport,
  onSend,
  sending,
  sessionMeta,
}: QqMessagePaneProps) {
  const canSend = Boolean(sessionMeta?.canSend && draft.trim() && !sending)

  return (
    <section className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card'>
      <div className='flex shrink-0 items-center justify-between border-b border-border px-4 py-3'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-semibold'>{qqSessionTitle(sessionMeta)}</div>
          <div className='text-xs text-muted-foreground'>
            {sessionMeta
              ? `会话版本 v${sessionMeta.conversationVersion} · ${sessionMeta.agentTitle ?? sessionMeta.agentId}`
              : '请在左侧选择会话'}
          </div>
        </div>
        {sessionMeta ? (
          <button
            className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-border hover:bg-muted'
            type='button'
            onClick={onExport}
          >
            <Download className='size-3.5' />
            导出
          </button>
        ) : null}
      </div>

      {error ? (
        <div className='mx-4 mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive'>{error}</div>
      ) : null}

      <MessageList
        copiedMessageId={copiedMessageId}
        loading={loading}
        messages={messages}
        onCopy={onCopy}
        onExport={onExport}
        sessionMeta={sessionMeta}
      />

      {sessionMeta ? (
        <div className='flex shrink-0 items-end gap-2 border-t border-border px-4 py-3 sm:px-6'>
          <textarea
            className='min-h-[44px] flex-1 resize-none rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:bg-background focus:ring-ring'
            placeholder={qqComposerPlaceholder(sessionMeta)}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (!canSend) return
                void onSend()
              }
            }}
          />
          <button
            className='inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50'
            disabled={!canSend}
            type='button'
            onClick={onSend}
          >
            {sending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
          </button>
        </div>
      ) : null}
    </section>
  )
}
