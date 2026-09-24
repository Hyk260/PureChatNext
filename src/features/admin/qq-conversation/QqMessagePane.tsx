'use client'

import { Bot, ExternalLink, User } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { formatDateTime, formatSize } from '@pure/utils/client'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import {
  ChannelAttachmentComposer,
  ChannelImageCard,
  ChannelMessagePaneFrame,
  CopyMessageButton,
  ExportSessionLink,
  MessagesEmptyState,
  MessagesLoadingState,
  StatusChip,
  channelBubbleClass,
  formatChannelDuration,
  isChannelImageFileName,
} from '@/features/admin/channel-conversation'
import type { ChannelPendingAttachment } from '@/features/admin/channel-conversation'

import type { QQAttachment, QQMessage, QQSession } from './qqConversationApi'
import { qqComposerPlaceholder, qqMessageUserLabel, qqSessionTitle } from './qqSessionLabels'

export type PendingAttachment = ChannelPendingAttachment

type QqMessagePaneProps = {
  copiedMessageId: string | null
  draft: string
  error: string | null
  fileInputRef: RefObject<HTMLInputElement | null>
  loading: boolean
  maxOutboundFiles: number
  messages: QQMessage[]
  onCopy: (text: string, id: string) => void
  onDraftChange: (value: string) => void
  onExport: () => void
  onPickFiles: (files: FileList | null) => void
  onRemovePending: (id: string) => void
  onSend: () => void
  pendingAttachments: PendingAttachment[]
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

function renderAttachment(attachment: QQAttachment, isRight?: boolean) {
  if (isChannelImageFileName(attachment.fileName)) {
    return <ChannelImageCard key={attachment.id} alt={attachment.fileName} isRight={isRight} src={attachment.fileUrl} />
  }
  return <AttachmentCard key={attachment.id} attachment={attachment} />
}

function renderUserLegacyMedia(message: QQMessage): ReactNode {
  if (!message.fileUrl || message.attachments?.length) return null
  if (isChannelImageFileName(message.fileName) || message.imageUrl) {
    return (
      <ChannelImageCard
        alt={message.fileName || '图片'}
        isRight
        src={message.imageUrl || message.fileUrl}
      />
    )
  }
  return (
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
  )
}

function renderBubbleBody(message: QQMessage, isUser: boolean, showText: boolean): ReactNode {
  return (
    <>
      {showText ? (
        isUser ? (
          <div className='whitespace-pre-wrap text-sm'>{message.text}</div>
        ) : (
          <MessageMarkdown text={message.text} />
        )
      ) : null}
      {isUser && message.attachments?.length ? (
        <div className='mt-2 space-y-2'>{message.attachments.map((item) => renderAttachment(item, true))}</div>
      ) : null}
      {isUser ? renderUserLegacyMedia(message) : null}
    </>
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

  if (loading) return <MessagesLoadingState />

  if (!sessionMeta || messages.length === 0) {
    return <MessagesEmptyState>暂无消息，等待 QQ 用户发送消息</MessagesEmptyState>
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
        const showText = Boolean(message.text.trim()) && message.text !== '[附件]'
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
              {!isUser && message.source === 'model' ? (
                <span className='rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary'>
                  {message.provider} / {message.model}
                  {typeof message.durationMs === 'number'
                    ? ` · ${formatChannelDuration(message.durationMs)}`
                    : ''}
                </span>
              ) : null}
              {!isUser && message.source === 'system' ? (
                <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>系统</span>
              ) : null}
              <span className='text-[10px] text-muted-foreground/60'>{formatDateTime(message.createdAt)}</span>
            </div>
            {showText || (isUser && hasMedia) ? (
              <div className={`group flex max-w-[92%] items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`max-w-[min(720px,100%)] rounded-2xl text-sm leading-relaxed shadow-sm ${channelBubbleClass(isUser)}`}
                >
                  {renderBubbleBody(message, isUser, showText)}
                </div>
                {showText && !hasMedia ? (
                  <span className='mb-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100'>
                    <CopyMessageButton
                      copied={copiedMessageId === message.id}
                      onCopy={() => void onCopy(message.text, message.id)}
                    />
                  </span>
                ) : null}
              </div>
            ) : null}
            {!isUser && message.attachments?.length ? (
              <div className='mt-1 flex max-w-[92%] flex-col items-start gap-2'>
                {message.attachments.map((attachment) => renderAttachment(attachment))}
              </div>
            ) : null}
          </div>
        )
      })}
      {/* <ExportSessionLink onExport={onExport} /> */}
    </div>
  )
}

export function QqMessagePane({
  copiedMessageId,
  draft,
  error,
  fileInputRef,
  loading,
  maxOutboundFiles,
  messages,
  onCopy,
  onDraftChange,
  onExport,
  onPickFiles,
  onRemovePending,
  onSend,
  pendingAttachments,
  sending,
  sessionMeta,
}: QqMessagePaneProps) {
  return (
    <ChannelMessagePaneFrame
      composer={
        sessionMeta ? (
          <ChannelAttachmentComposer
            attachTitle='上传图片或文件（群聊仅图片）'
            canSend={Boolean(sessionMeta.canSend)}
            draft={draft}
            fileInputRef={fileInputRef}
            maxOutboundFiles={maxOutboundFiles}
            pendingAttachments={pendingAttachments}
            placeholder={qqComposerPlaceholder(sessionMeta)}
            sending={sending}
            onDraftChange={onDraftChange}
            onPickFiles={onPickFiles}
            onRemovePending={onRemovePending}
            onSend={onSend}
          />
        ) : undefined
      }
      error={error}
      subtitle={
        sessionMeta
          ? `会话版本 v${sessionMeta.conversationVersion} · ${sessionMeta.agentTitle ?? sessionMeta.agentId}`
          : '请在左侧选择会话'
      }
      title={qqSessionTitle(sessionMeta)}
      onExport={sessionMeta ? onExport : undefined}
    >
      <MessageList
        copiedMessageId={copiedMessageId}
        loading={loading}
        messages={messages}
        sessionMeta={sessionMeta}
        onCopy={onCopy}
        onExport={onExport}
      />
    </ChannelMessagePaneFrame>
  )
}
