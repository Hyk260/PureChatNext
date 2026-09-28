'use client'

import { Button, TextArea } from '@pure/ui'
import { Download, Paperclip } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

import { useImeEnterGuard } from '@/features/chat/useImeEnterGuard'

import {
  ChannelErrorBanner,
  ChannelPendingAttachmentChip,
  ComposerSendButton,
  PaneHeaderButton,
} from './ConversationShared'

export type ChannelPendingAttachment = {
  file: File
  id: string
  previewUrl: string | null
}

type ChannelMessagePaneFrameProps = {
  actions?: ReactNode
  children: ReactNode
  composer?: ReactNode
  error: string | null
  onExport?: () => void
  subtitle: ReactNode
  title: ReactNode
}

export function ChannelMessagePaneFrame({
  actions,
  children,
  composer,
  error,
  onExport,
  subtitle,
  title,
}: ChannelMessagePaneFrameProps) {
  return (
    <section className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background'>
      <div className='flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6'>
        <div className='min-w-0'>
          <div className='truncate text-base font-semibold'>{title}</div>
          <div className='mt-0.5 truncate text-xs text-muted-foreground'>{subtitle}</div>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {actions}
          {onExport ? (
            <PaneHeaderButton onClick={onExport}>
              <Download className='size-3.5' />
              导出
            </PaneHeaderButton>
          ) : null}
        </div>
      </div>

      <ChannelErrorBanner error={error} />
      {children}
      {composer}
    </section>
  )
}

type ChannelAttachmentComposerProps = {
  attachTitle?: string
  canSend: boolean
  draft: string
  fileInputRef: RefObject<HTMLInputElement | null>
  maxOutboundFiles: number
  onDraftChange: (value: string) => void
  onPickFiles: (files: FileList | null) => void
  onRemovePending: (id: string) => void
  onSend: () => void
  pendingAttachments: ChannelPendingAttachment[]
  placeholder: string
  sending: boolean
}

/** QQ / 微信共用：带附件芯片的代发输入条。 */
export function ChannelAttachmentComposer({
  attachTitle = '上传图片或文件',
  canSend,
  draft,
  fileInputRef,
  maxOutboundFiles,
  onDraftChange,
  onPickFiles,
  onRemovePending,
  onSend,
  pendingAttachments,
  placeholder,
  sending,
}: ChannelAttachmentComposerProps) {
  const canSubmit = Boolean(canSend && !sending && (draft.trim() || pendingAttachments.length > 0))
  const { onCompositionEnd, onCompositionStart, shouldIgnoreEnter } = useImeEnterGuard()

  return (
    <div className='shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6'>
      {pendingAttachments.length > 0 ? (
        <div className='mb-2 flex flex-wrap gap-2'>
          {pendingAttachments.map((item) => (
            <ChannelPendingAttachmentChip
              key={item.id}
              disabled={sending}
              file={item.file}
              previewUrl={item.previewUrl}
              onRemove={() => onRemovePending(item.id)}
            />
          ))}
        </div>
      ) : null}
      <div className='flex min-w-0 flex-col rounded-xl bg-background ring-1 ring-border transition focus-within:ring-primary/50'>
        <TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          className='!bg-transparent !px-3 !pt-3 !pb-1'
          disabled={!canSend || sending}
          placeholder={placeholder}
          value={draft}
          variant='borderless'
          onChange={(event) => onDraftChange(event.target.value)}
          onCompositionEnd={onCompositionEnd}
          onCompositionStart={onCompositionStart}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            if (shouldIgnoreEnter(event)) return
            event.preventDefault()
            if (!canSubmit) return
            void onSend()
          }}
        />
        <div className='flex items-center justify-between gap-2 px-2 pb-1.5'>
          <div className='flex items-center'>
            <input
              ref={fileInputRef}
              accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.pptx'
              className='hidden'
              multiple
              type='file'
              onChange={(event) => onPickFiles(event.target.files)}
            />
            <Button
              aria-label='添加附件'
              disabled={!canSend || sending || pendingAttachments.length >= maxOutboundFiles}
              icon={<Paperclip className='size-3.5' />}
              size='small'
              title={attachTitle}
              type='text'
              onClick={() => fileInputRef.current?.click()}
            >
              附件
            </Button>
          </div>
          <ComposerSendButton disabled={!canSubmit} sending={sending} onClick={onSend} />
        </div>
      </div>
    </div>
  )
}
