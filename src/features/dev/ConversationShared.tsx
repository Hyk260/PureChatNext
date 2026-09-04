'use client'

import { Check, Copy, Download, Loader2 } from 'lucide-react'
import { Segmented } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Tag } from '@pure/ui'

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

  return <Tag color={colors[status] ?? 'default'} size='small'>{labels[status] ?? status}</Tag>
}

type ConversationExportDialogProps<Message, Session, Mode extends string> = {
  exportMode: Mode
  messages: Message[]
  onClose: () => void
  session: Session
  createExport: (mode: Mode, messages: Message[], session: Session) => unknown
  createFilename: (session: Session) => string
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
          {feedback ? <span className='mr-auto text-xs text-slate-500'>{feedback}</span> : null}
          <Button icon={<Copy className='size-3.5' />} onClick={() => void copy()}>复制 JSON</Button>
          <Button type='primary' icon={<Download className='size-3.5' />} onClick={download}>下载文件</Button>
        </div>
      }
      open
      title={
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-3 pr-6'>
          <div className='min-w-0'>
            <div id='conversation-export-title' className='truncate text-base font-semibold'>
              {title}
            </div>
            <div className='mt-0.5 truncate text-xs font-normal text-slate-500'>仅包含当前页面已加载的消息</div>
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
      styles={{ body: { maxHeight: '70vh', padding: 0 } }}
      onCancel={onClose}
    >
      <pre className='max-h-[70vh] min-h-[280px] overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-200'>{content}</pre>
    </Modal>
  )
}

export function LoadingConversation({ label }: { label: string }) {
  return (
    <div className='flex h-screen items-center justify-center bg-[#f0f2f5] text-slate-500'>
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
