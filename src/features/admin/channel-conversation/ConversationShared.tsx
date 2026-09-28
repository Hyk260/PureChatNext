'use client'

import { Check, Copy, Download, Loader2, X } from 'lucide-react'
import { Alert, Segmented } from 'antd'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { formatSize } from '@pure/utils/client'
import { Button, Image, MaterialFileTypeIcon, Modal, Tag } from '@pure/ui'

import SendButton from '@/features/chat/SendArea/SendButton'
import { READ_FILE_API_PATH } from '@/features/admin/read-file/readFileModel'
import { apiFetch } from '@/utils/apiFetch'

export function StatusChip({ status }: { status?: string }) {
  if (!status || status === 'completed') return null

  const labels: Record<string, string> = {
    canceled: '已取消',
    failed: '失败',
    pending: '排队',
    processing: '处理中',
    retry: '重试',
  }
  const colors: Record<string, string> = {
    canceled: 'default',
    failed: 'red',
    pending: 'blue',
    processing: 'orange',
    retry: 'orange',
  }

  return (
    <Tag color={colors[status] ?? 'default'} size='small'>
      {labels[status] ?? status}
    </Tag>
  )
}

type ConversationExportDialogProps<Message, Session, Mode extends string> = {
  createExport: (mode: Mode, messages: Message[], session: Session) => unknown
  createFilename: (session: Session) => string
  exportMode: Mode
  messages: Message[]
  onClose: () => void
  session: Session
  title: string
}

export function ConversationExportDialog<Message, Session, Mode extends string>({
  createExport,
  createFilename,
  exportMode,
  messages,
  onClose,
  session,
  title,
}: ConversationExportDialogProps<Message, Session, Mode>) {
  const [mode, setMode] = useState<Mode>(exportMode)
  const [feedback, setFeedback] = useState<string | null>(null)
  const content = useMemo(
    () => JSON.stringify(createExport(mode, messages, session), null, 2),
    [createExport, messages, mode, session]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
    link.download = createFilename(session)
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      aria-labelledby='conversation-export-title'
      footer={
        <div className='flex flex-wrap items-center justify-end gap-2'>
          {feedback ? <span className='mr-auto text-xs text-muted-foreground'>{feedback}</span> : null}
          <Button icon={<Copy className='size-3.5' />} onClick={() => void copy()}>
            复制 JSON
          </Button>
          <Button icon={<Download className='size-3.5' />} type='primary' onClick={download}>
            下载文件
          </Button>
        </div>
      }
      open
      styles={{ body: { maxHeight: '70vh', padding: 0 } }}
      title={
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-3 pr-6'>
          <div className='min-w-0'>
            <div id='conversation-export-title' className='truncate text-base font-semibold'>
              {title}
            </div>
            <div className='mt-0.5 truncate text-xs font-normal text-muted-foreground'>仅包含当前页面已加载的消息</div>
          </div>
          <Segmented
            className='shrink-0'
            options={[
              { label: '完整 JSON', value: 'full' },
              { label: 'OpenAI 兼容', value: 'openai' },
            ]}
            size='small'
            value={mode}
            onChange={(value) => {
              setMode(value as Mode)
              setFeedback(null)
            }}
          />
        </div>
      }
      width='min(90vw, 768px)'
      onCancel={onClose}
    >
      <pre className='max-h-[70vh] min-h-[280px] overflow-auto bg-muted p-5 text-xs leading-5 text-foreground'>
        {content}
      </pre>
    </Modal>
  )
}

export function LoadingConversation({ label }: { label: string }) {
  return (
    <div className='flex h-full min-h-0 items-center justify-center bg-background text-muted-foreground'>
      <Loader2 className='mr-2 size-4 animate-spin' />
      {label}
    </div>
  )
}

export function CopyMessageButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <Button
      aria-label={copied ? '已复制' : '复制消息'}
      icon={copied ? <Check className='size-3.5 text-emerald-600' /> : <Copy className='size-3.5' />}
      size='small'
      title={copied ? '已复制' : '复制'}
      type='text'
      onClick={onCopy}
    />
  )
}

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <Tag color={connected ? 'green' : 'red'} shape='round' size='small'>
      <span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-destructive'}`} />
      {connected ? '已连接' : '未连接'}
    </Tag>
  )
}

export function ChannelErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  return <Alert key={error} className='mx-4 mt-3' title={error} showIcon type='error' closable />
}

export function MessagesLoadingState() {
  return (
    <div className='flex min-h-0 flex-1 items-center justify-center text-muted-foreground'>
      <Loader2 className='mr-2 size-4 animate-spin' />
      加载消息
    </div>
  )
}

export function MessagesEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-muted-foreground'>
      {children}
    </div>
  )
}

export function ExportSessionLink({ onExport }: { onExport: () => void }) {
  return (
    <Button className='mx-auto my-4 !flex' size='small' type='link' onClick={onExport}>
      导出当前会话
    </Button>
  )
}

export function PaneHeaderButton({
  'aria-label': ariaLabel,
  children,
  disabled,
  onClick,
  title,
}: {
  'aria-label'?: string
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <Button aria-label={ariaLabel} disabled={disabled} size='small' title={title} onClick={onClick}>
      {children}
    </Button>
  )
}

export function ComposerSendButton({
  disabled,
  onClick,
  sending,
}: {
  disabled: boolean
  onClick: () => void
  sending: boolean
}) {
  return <SendButton disabled={disabled} loading={sending} onClick={onClick} />
}

/** 渠道会话气泡内图片：点击走 @pure/ui Image 预览。 */
export function ChannelImageCard({ alt, isRight, src }: { alt: string; isRight?: boolean; src: string }) {
  return (
    <Image
      alt={alt}
      classNames={{
        image: 'max-h-80 max-w-full rounded-xl object-contain',
        wrapper: `overflow-hidden rounded-2xl bg-background p-1 ring-1 ring-border ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}`,
      }}
      maxHeight={320}
      objectFit='contain'
      preview
      src={src}
      variant='borderless'
    />
  )
}

function PendingFileContentPreview({ file, onClose }: { file: File; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setContent(null)
      try {
        const form = new FormData()
        form.set('file', file)
        const res = await apiFetch(READ_FILE_API_PATH, { body: form, method: 'POST' })
        const data = (await res.json().catch(() => null)) as {
          content?: string
          error?: string
          filename?: string
          totalCharCount?: number
        } | null
        if (cancelled) return
        if (!res.ok) {
          setError(data?.error || `预览失败: ${res.status}`)
          return
        }
        const text = typeof data?.content === 'string' ? data.content.trim() : ''
        // ponytail: 预览截断，完整解析仍走 read-file；超长时再做分页 UI
        if (!text) {
          setContent('（文件无文本内容）')
        } else if (text.length > 20_000) {
          setContent(`${text.slice(0, 20_000)}\n\n…（已截断，共 ${text.length.toLocaleString()} 字符）`)
        } else {
          setContent(text)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '预览失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [file])

  return (
    <Modal destroyOnHidden footer={null} open title={`预览 · ${file.name}`} width={640} onCancel={onClose}>
      {loading ? (
        <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          正在解析…
        </div>
      ) : error ? (
        <div className='py-4 text-sm text-destructive'>{error}</div>
      ) : (
        <pre className='max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed'>
          {content}
        </pre>
      )}
    </Modal>
  )
}

/** 待发附件芯片：图片可点击预览；其它文件点图标用 file-loaders（read-file API）解析预览。 */
export function ChannelPendingAttachmentChip({
  disabled,
  file,
  onRemove,
  previewUrl,
}: {
  disabled?: boolean
  file: File
  onRemove: () => void
  previewUrl: string | null
}) {
  const [filePreviewOpen, setFilePreviewOpen] = useState(false)

  return (
    <>
      <div className='relative flex items-center gap-2 rounded-xl bg-muted px-2 py-1.5 ring-1 ring-border'>
        {previewUrl ? (
          <Image
            alt={file.name}
            classNames={{
              image: 'size-10 rounded-lg object-cover',
              wrapper: 'size-10 shrink-0 overflow-hidden rounded-lg',
            }}
            height={40}
            objectFit='cover'
            preview
            size={40}
            src={previewUrl}
            variant='borderless'
            width={40}
          />
        ) : (
          <Button
            aria-label={`预览 ${file.name}`}
            disabled={disabled}
            icon={<MaterialFileTypeIcon filename={file.name} size={24} type='file' variant='raw' />}
            size='large'
            onClick={() => setFilePreviewOpen(true)}
          />
        )}
        <div className='min-w-0 max-w-[160px]'>
          <div className='truncate text-xs font-medium'>{file.name}</div>
          <div className='text-[10px] text-muted-foreground'>{formatSize(file.size)}</div>
        </div>
        <Button
          aria-label={`移除 ${file.name}`}
          disabled={disabled}
          icon={<X className='size-3.5' />}
          size='small'
          type='text'
          onClick={onRemove}
        />
      </div>
      {filePreviewOpen ? <PendingFileContentPreview file={file} onClose={() => setFilePreviewOpen(false)} /> : null}
    </>
  )
}
