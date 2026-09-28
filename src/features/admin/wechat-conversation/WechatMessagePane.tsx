'use client'

import { ArrowLeftRight, Bot, File, FileArchive, FileCode, FileSpreadsheet, FileText, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { formatDateTime, formatSize } from '@pure/utils/client'
import { Tag } from '@pure/ui'

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
  PaneHeaderButton,
  StatusChip,
  channelBubbleClass,
  formatChannelDuration,
  isChannelImageFileName,
} from '@/features/admin/channel-conversation'
import type { ChannelPendingAttachment } from '@/features/admin/channel-conversation'

import type { WechatDevMessage, WechatDevSession } from './wechatConversationApi'
import { wechatAccessLabel, wechatComposerPlaceholder, wechatSessionTitle } from './wechatSessionLabels'

export type ChatPerspective = 'agent' | 'wechat'

export type PendingAttachment = ChannelPendingAttachment

const KIND_LABEL: Record<string, string> = {
  command: '指令',
  file: '文件',
  image: '图片',
  unsupported: '不支持',
}

const DELIVERY_LABEL: Record<string, string> = {
  sending: '发送中',
  sent: '已发送',
}

type WechatMessagePaneProps = {
  copiedMessageId: string | null
  draft: string
  error: string | null
  fileInputRef: RefObject<HTMLInputElement | null>
  loading: boolean
  maxOutboundFiles: number
  messages: WechatDevMessage[]
  onCopy: (message: WechatDevMessage) => void
  onDraftChange: (value: string) => void
  onExport: () => void
  onPerspectiveToggle: () => void
  onPickFiles: (files: FileList | null) => void
  onRemovePending: (id: string) => void
  onSend: () => void
  pendingAttachments: PendingAttachment[]
  perspective: ChatPerspective
  sending: boolean
  sessionMeta: WechatDevSession | null
}

function kindChip(kind?: string) {
  if (!kind || kind === 'text' || kind === 'outbound') return null
  return <Tag size='small'>{KIND_LABEL[kind] ?? kind}</Tag>
}

type FileVisual = {
  Icon: LucideIcon
  iconClass: string
  wrapClass: string
}

function fileVisual(fileName?: string): FileVisual {
  const ext = (fileName?.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') {
    return { Icon: FileText, iconClass: 'text-rose-600', wrapClass: 'bg-rose-500/10 ring-rose-500/20' }
  }
  if (['doc', 'docx'].includes(ext)) {
    return { Icon: FileText, iconClass: 'text-sky-600', wrapClass: 'bg-sky-500/10 ring-sky-500/20' }
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { Icon: FileSpreadsheet, iconClass: 'text-emerald-600', wrapClass: 'bg-emerald-500/10 ring-emerald-500/20' }
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { Icon: FileText, iconClass: 'text-orange-600', wrapClass: 'bg-orange-500/10 ring-orange-500/20' }
  }
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) {
    return { Icon: FileArchive, iconClass: 'text-amber-600', wrapClass: 'bg-amber-500/10 ring-amber-500/20' }
  }
  if (['md', 'txt', 'json', 'xml', 'yml', 'yaml', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'].includes(ext)) {
    return { Icon: FileCode, iconClass: 'text-muted-foreground', wrapClass: 'bg-muted ring-border' }
  }
  return { Icon: File, iconClass: 'text-muted-foreground', wrapClass: 'bg-muted ring-border' }
}

function FileMessageCard({
  fileName,
  fileSize,
  fileUrl,
}: {
  fileName?: string
  fileSize?: number | null
  fileUrl?: string
}) {
  const { Icon, iconClass, wrapClass } = fileVisual(fileName)
  const name = fileName || '未命名文件'
  const sizeLabel = typeof fileSize === 'number' ? formatSize(fileSize) : '未知大小'
  const inner = (
    <div className='flex min-w-[220px] max-w-[320px] items-center gap-3 rounded-xl bg-background px-3 py-2.5 ring-1 ring-border'>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${wrapClass}`}>
        <Icon className={`size-5 ${iconClass}`} />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium text-foreground' title={name}>
          {name}
        </div>
        <div className='mt-0.5 text-[11px] text-muted-foreground'>{sizeLabel}</div>
      </div>
    </div>
  )
  if (!fileUrl) return inner
  return (
    <a className='block transition hover:opacity-90' href={fileUrl} rel='noreferrer' target='_blank'>
      {inner}
    </a>
  )
}

function MessageList({
  copiedMessageId,
  loading,
  messages,
  onCopy,
  onExport,
  perspective,
  sessionMeta,
}: Pick<
  WechatMessagePaneProps,
  'copiedMessageId' | 'loading' | 'messages' | 'onCopy' | 'onExport' | 'perspective' | 'sessionMeta'
>) {
  const { handleScroll, ref: scrollRef } = useAutoScroll({
    deps: [messages],
    initialScrollToBottom: true,
  })
  const userLabel = wechatSessionTitle(sessionMeta)

  if (loading) return <MessagesLoadingState />

  if (!sessionMeta || messages.length === 0) {
    return (
      <MessagesEmptyState>
        <p className='text-sm'>{sessionMeta ? '当前对话版本暂无消息' : '请在左侧选择会话'}</p>
        {sessionMeta ? <p className='text-xs'>发送消息或切换 /new 后会显示在这里</p> : null}
      </MessagesEmptyState>
    )
  }

  return (
    <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8' ref={scrollRef} onScroll={handleScroll}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user'
        const isRight = perspective === 'agent' ? isUser : !isUser
        const hasMedia = Boolean(msg.imageUrl || msg.fileUrl)
        const showTextBubble = Boolean(msg.text.trim()) && !(isUser && hasMedia) && msg.text !== '[附件]'

        let content: ReactNode = null
        if (isUser && msg.imageUrl) {
          content = <ChannelImageCard alt='微信图片' isRight={isRight} src={msg.imageUrl} />
        } else if (isUser && msg.fileUrl) {
          content = <FileMessageCard fileName={msg.fileName} fileSize={msg.fileSize} fileUrl={msg.fileUrl} />
        } else if (isUser) {
          content = <div className='whitespace-pre-wrap wrap-break-word'>{msg.text}</div>
        } else if (showTextBubble) {
          content = <MessageMarkdown text={msg.text} />
        }

        return (
          <div key={msg.id} className={`flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
            <div className='flex items-center gap-1.5 px-1'>
              {isUser ? <User className='size-3 text-muted-foreground' /> : <Bot className='size-3 text-primary' />}
              <span className='text-xs font-medium text-muted-foreground'>{isUser ? userLabel : 'Agent'}</span>
              {kindChip(msg.messageKind)}
              <StatusChip status={msg.status} />
              {!isUser && msg.source === 'manual' ? (
                <span className='rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400'>
                  代发
                </span>
              ) : null}
              {!isUser && msg.source === 'system' ? (
                <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>系统</span>
              ) : null}
              <span className='text-[11px] text-muted-foreground'>{formatDateTime(msg.createdAt)}</span>
            </div>
            {content ? (
              <div className={`group flex max-w-[92%] items-end gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`max-w-[min(720px,100%)] rounded-2xl text-sm leading-relaxed shadow-sm ${channelBubbleClass(isUser, { hasMedia, isRight })}`}
                >
                  {content}
                </div>
                {!hasMedia && msg.text.trim() && msg.text !== '[附件]' ? (
                  <span className='mb-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100'>
                    <CopyMessageButton copied={copiedMessageId === msg.id} onCopy={() => onCopy(msg)} />
                  </span>
                ) : null}
              </div>
            ) : null}
            {!isUser && msg.attachments?.length ? (
              <div className={`mt-1 flex max-w-[92%] flex-col gap-2 ${isRight ? 'items-end' : 'items-start'}`}>
                {msg.attachments.map((attachment) => (
                  <div key={attachment.id}>
                    {isChannelImageFileName(attachment.fileName) ? (
                      <ChannelImageCard alt={attachment.fileName} isRight={isRight} src={attachment.fileUrl} />
                    ) : (
                      <FileMessageCard
                        fileName={attachment.fileName}
                        fileSize={attachment.fileSize}
                        fileUrl={attachment.fileUrl}
                      />
                    )}
                    {/* <div className='mt-1 flex max-w-[320px] items-center gap-2 px-1 text-[10px] text-muted-foreground'>
                      <span>v{attachment.version}</span>
                      <span>·</span>
                      <span>{DELIVERY_LABEL[attachment.deliveryStatus] ?? '待重试'}</span>
                      {attachment.summary ? <span className='truncate'>{attachment.summary}</span> : null}
                    </div> */}
                  </div>
                ))}
              </div>
            ) : null}
            {!isUser && msg.source === 'model' ? (
              <span className='px-1 font-mono text-[11px] text-muted-foreground'>
                {msg.provider} / {msg.model}
                {typeof msg.durationMs === 'number' ? ` · ${formatChannelDuration(msg.durationMs)}` : ''}
              </span>
            ) : null}
          </div>
        )
      })}
      {/* <ExportSessionLink onExport={onExport} /> */}
    </div>
  )
}

export function WechatMessagePane({
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
  onPerspectiveToggle,
  onPickFiles,
  onRemovePending,
  onSend,
  pendingAttachments,
  perspective,
  sending,
  sessionMeta,
}: WechatMessagePaneProps) {
  return (
    <ChannelMessagePaneFrame
      actions={
        sessionMeta ? (
          <PaneHeaderButton
            aria-label='切换消息视角'
            title={perspective === 'agent' ? '当前：Agent 左 / 微信右' : '当前：微信 左 / Agent 右'}
            onClick={onPerspectiveToggle}
          >
            <ArrowLeftRight className='size-3.5' />
            {perspective === 'agent' ? 'Agent 视角' : '微信视角'}
          </PaneHeaderButton>
        ) : undefined
      }
      composer={
        sessionMeta ? (
          <ChannelAttachmentComposer
            canSend={Boolean(sessionMeta.canSend)}
            draft={draft}
            fileInputRef={fileInputRef}
            maxOutboundFiles={maxOutboundFiles}
            pendingAttachments={pendingAttachments}
            placeholder={wechatComposerPlaceholder(sessionMeta)}
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
      title={
        sessionMeta ? (
          <span className='inline-flex min-w-0 items-center gap-2'>
            <span className='truncate'>{wechatSessionTitle(sessionMeta)}</span>
            <Tag color={sessionMeta.canSend ? 'green' : 'default'} size='small'>
              {wechatAccessLabel(sessionMeta.canSend, sessionMeta.isOwnBinding)}
            </Tag>
          </span>
        ) : (
          wechatSessionTitle(null)
        )
      }
      onExport={sessionMeta ? onExport : undefined}
    >
      <MessageList
        copiedMessageId={copiedMessageId}
        loading={loading}
        messages={messages}
        perspective={perspective}
        sessionMeta={sessionMeta}
        onCopy={onCopy}
        onExport={onExport}
      />
    </ChannelMessagePaneFrame>
  )
}
