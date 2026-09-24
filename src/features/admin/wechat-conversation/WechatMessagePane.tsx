'use client'

import {
  ArrowLeftRight,
  Bot,
  Download,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Send,
  User,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { formatDateTime, formatSize } from '@pure/utils/client'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import { CopyMessageButton, StatusChip } from '@/features/dev/ConversationShared'

import type { WechatDevMessage, WechatDevSession } from './wechatConversationApi'
import {
  formatDuration,
  wechatAccessLabel,
  wechatComposerPlaceholder,
  wechatSessionTitle,
} from './wechatSessionLabels'

export type ChatPerspective = 'agent' | 'wechat'

export type PendingAttachment = {
  file: File
  id: string
  previewUrl: string | null
}

const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp|bmp)$/i

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

function isImageFileName(fileName?: string, mimeType?: string) {
  if (mimeType?.startsWith('image/')) return true
  return IMAGE_FILE_RE.test(fileName || '')
}

function kindChip(kind?: string) {
  if (!kind || kind === 'text' || kind === 'outbound') return null
  return (
    <span className='inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>
      {KIND_LABEL[kind] ?? kind}
    </span>
  )
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
    <a className='block transition hover:opacity-90' download href={fileUrl} rel='noreferrer'>
      {inner}
    </a>
  )
}

function ImageCard({ alt, href, isRight }: { alt: string; href: string; isRight: boolean }) {
  return (
    <a
      className={`block overflow-hidden rounded-2xl bg-background p-1 ring-1 ring-border ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}`}
      href={href}
      rel='noreferrer'
      target='_blank'
    >
      {/* Auth-gated same-origin proxy; next/image is a poor fit here. */}
      <img alt={alt} className='max-h-80 max-w-full rounded-xl object-contain' loading='lazy' src={href} />
    </a>
  )
}

function bubbleClass(isRight: boolean, isUser: boolean, hasMedia: boolean) {
  const corner = isRight ? 'rounded-br-md' : 'rounded-bl-md'
  if (isUser && hasMedia) return `overflow-hidden ${corner} bg-transparent p-0 shadow-none`
  if (isUser) return `${corner} bg-primary px-3.5 py-2.5 text-primary-foreground`
  return `${corner} bg-muted px-3.5 py-2.5 text-foreground ring-1 ring-border`
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
      <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-muted-foreground'>
        <p className='text-sm'>{sessionMeta ? '当前对话版本暂无消息' : '请在左侧选择会话'}</p>
        {sessionMeta ? <p className='text-xs'>发送消息或切换 /new 后会显示在这里</p> : null}
      </div>
    )
  }

  return (
    <div
      className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6'
      ref={scrollRef}
      onScroll={handleScroll}
    >
      {messages.map((msg) => {
        const isUser = msg.role === 'user'
        const isRight = perspective === 'agent' ? isUser : !isUser
        const hasMedia = Boolean(msg.imageUrl || msg.fileUrl)
        const showTextBubble = Boolean(msg.text.trim()) && !(isUser && hasMedia) && msg.text !== '[附件]'

        let content: ReactNode = null
        if (isUser && msg.imageUrl) {
          content = <ImageCard alt='微信图片' href={msg.imageUrl} isRight={isRight} />
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
              {isUser ? (
                <User className='size-3 text-muted-foreground' />
              ) : (
                <Bot className='size-3 text-primary' />
              )}
              <span className='text-[10px] font-medium text-muted-foreground'>
                {isUser ? userLabel : 'Agent'}
              </span>
              {kindChip(msg.messageKind)}
              <StatusChip status={msg.status} />
              {!isUser && msg.source === 'model' ? (
                <span className='rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary'>
                  {msg.provider} / {msg.model}
                  {typeof msg.durationMs === 'number' ? ` · ${formatDuration(msg.durationMs)}` : ''}
                </span>
              ) : null}
              {!isUser && msg.source === 'system' ? (
                <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>系统</span>
              ) : null}
              <span className='text-[10px] text-muted-foreground/60'>{formatDateTime(msg.createdAt)}</span>
            </div>
            {content ? (
              <div className={`group flex max-w-[92%] items-end gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`max-w-[min(720px,100%)] rounded-2xl text-sm leading-relaxed shadow-sm ${bubbleClass(isRight, isUser, hasMedia)}`}
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
                    {isImageFileName(attachment.fileName) ? (
                      <ImageCard alt={attachment.fileName} href={attachment.fileUrl} isRight={isRight} />
                    ) : (
                      <FileMessageCard
                        fileName={attachment.fileName}
                        fileSize={attachment.fileSize}
                        fileUrl={attachment.fileUrl}
                      />
                    )}
                    <div className='mt-1 flex max-w-[320px] items-center gap-2 px-1 text-[10px] text-muted-foreground'>
                      <span>v{attachment.version}</span>
                      <span>·</span>
                      <span>{DELIVERY_LABEL[attachment.deliveryStatus] ?? '待重试'}</span>
                      {attachment.summary ? <span className='truncate'>{attachment.summary}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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
  const canSend = Boolean(sessionMeta?.canSend)
  const canSubmit =
    Boolean(sessionMeta?.canSend && !sending && (draft.trim() || pendingAttachments.length > 0))

  return (
    <section className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card'>
      <div className='flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <div className='truncate text-sm font-semibold'>{wechatSessionTitle(sessionMeta)}</div>
            {sessionMeta ? (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  canSend
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {wechatAccessLabel(canSend, sessionMeta.isOwnBinding)}
              </span>
            ) : null}
          </div>
          <div className='text-xs text-muted-foreground'>
            {sessionMeta
              ? `会话版本 v${sessionMeta.conversationVersion} · ${sessionMeta.agentTitle ?? sessionMeta.agentId}`
              : '请在左侧选择会话'}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {sessionMeta ? (
            <button
              aria-label='切换消息视角'
              className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-border hover:bg-muted'
              title={perspective === 'agent' ? '当前：Agent 左 / 微信右' : '当前：微信 左 / Agent 右'}
              type='button'
              onClick={onPerspectiveToggle}
            >
              <ArrowLeftRight className='size-3.5' />
              {perspective === 'agent' ? 'Agent 视角' : '微信视角'}
            </button>
          ) : null}
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
      </div>

      {error ? (
        <div className='mx-4 mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive'>{error}</div>
      ) : null}

      <MessageList
        copiedMessageId={copiedMessageId}
        loading={loading}
        messages={messages}
        perspective={perspective}
        sessionMeta={sessionMeta}
        onCopy={onCopy}
        onExport={onExport}
      />

      {sessionMeta ? (
        <div className='shrink-0 border-t border-border px-4 py-3 sm:px-6'>
          {pendingAttachments.length > 0 ? (
            <div className='mb-2 flex flex-wrap gap-2'>
              {pendingAttachments.map((item) => (
                <div
                  key={item.id}
                  className='relative flex items-center gap-2 rounded-xl bg-muted px-2 py-1.5 ring-1 ring-border'
                >
                  {item.previewUrl ? (
                    <img alt={item.file.name} className='size-10 rounded-lg object-cover' src={item.previewUrl} />
                  ) : (
                    <div className='flex size-10 items-center justify-center rounded-lg bg-background ring-1 ring-border'>
                      <File className='size-4 text-muted-foreground' />
                    </div>
                  )}
                  <div className='min-w-0 max-w-[160px]'>
                    <div className='truncate text-xs font-medium'>{item.file.name}</div>
                    <div className='text-[10px] text-muted-foreground'>{formatSize(item.file.size)}</div>
                  </div>
                  <button
                    aria-label={`移除 ${item.file.name}`}
                    className='rounded-md p-1 text-muted-foreground transition hover:bg-background hover:text-foreground'
                    disabled={sending}
                    type='button'
                    onClick={() => onRemovePending(item.id)}
                  >
                    <X className='size-3.5' />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className='flex items-end gap-2'>
            <div className='flex min-w-0 flex-1 flex-col rounded-xl bg-muted ring-1 ring-border focus-within:bg-background focus-within:ring-ring'>
              <textarea
                className='min-h-[44px] max-h-36 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50'
                disabled={!canSend || sending}
                placeholder={wechatComposerPlaceholder(sessionMeta)}
                rows={2}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (!canSubmit) return
                    void onSend()
                  }
                }}
              />
              <div className='flex items-center px-2 pb-1.5'>
                <input
                  ref={fileInputRef}
                  accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.pptx'
                  className='hidden'
                  multiple
                  type='file'
                  onChange={(event) => onPickFiles(event.target.files)}
                />
                <button
                  aria-label='添加附件'
                  className='inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-40'
                  disabled={!canSend || sending || pendingAttachments.length >= maxOutboundFiles}
                  title='上传图片或文件'
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className='size-3.5' />
                  附件
                </button>
              </div>
            </div>
            <button
              className='inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50'
              disabled={!canSubmit}
              type='button'
              onClick={onSend}
            >
              {sending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
