import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { useState } from 'react'
import { FileText, Link2, RefreshCcw, Sparkles, UploadCloud, X } from 'lucide-react'
import { formatSize } from '@pure/utils/client'

import { ActionIcon, Button, Input } from '@pure/ui'

import Scrollbar from '@/components/Scrollbar'

import {
  MODE_META,
  canSubmit,
  createSampleFile,
  metaRows,
} from './readFileModel'
import type { RequestMode, RunState } from './readFileModel'

const LABEL_CLASS = 'text-sm font-medium text-foreground'
const DROP_IDLE =
  'flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary px-4 py-6 text-center transition hover:border-primary hover:bg-hover'
const DROP_ACTIVE =
  'flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary bg-secondary px-4 py-6 text-center transition'

function Field({
  children,
  hint,
  htmlFor,
  label,
}: {
  children: ReactNode
  hint?: string
  htmlFor?: string
  label: string
}) {
  return (
    <div>
      {htmlFor ? (
        <label className={LABEL_CLASS} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className={LABEL_CLASS}>{label}</div>
      )}
      <div className='mt-2'>{children}</div>
      {hint ? <p className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</p> : null}
    </div>
  )
}

export function ReadFileForm({
  file,
  isLoading,
  mode,
  onFile,
  onMode,
  onReset,
  onSubmit,
  onUrl,
  runState,
  url,
}: {
  file: File | null
  isLoading: boolean
  mode: RequestMode
  onFile: (file: File | null) => void
  onMode: (mode: RequestMode) => void
  onReset: () => void
  onSubmit: () => void
  onUrl: (url: string) => void
  runState: RunState | null
  url: string
}) {
  const [isDragging, setIsDragging] = useState(false)
  const canSend = canSubmit(mode, file, url)

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    onFile(event.dataTransfer.files?.[0] ?? null)
  }

  return (
    <section className='flex min-h-[32rem] flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <Scrollbar className='min-h-0 flex-1'>
        <div className='flex flex-col gap-4 p-4'>
          <p className='text-sm leading-6 text-muted-foreground'>{MODE_META[mode].description}</p>

          <div className='grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1'>
            {(['file', 'url'] as const).map((value) => (
              <button
                key={value}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                type='button'
                onClick={() => onMode(value)}
              >
                {value === 'file' ? <UploadCloud className='size-4' /> : <Link2 className='size-4' />}
                {MODE_META[value].label}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <>
              <Field label='选择文件'>
                <label
                  className={isDragging ? DROP_ACTIVE : DROP_IDLE}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDrop={onDrop}
                >
                  <UploadCloud className='size-6 text-muted-foreground' />
                  <span className='mt-3 text-sm font-medium text-foreground'>拖拽文件到这里，或点击选择</span>
                  <span className='mt-1 text-xs text-muted-foreground'>支持文本、PDF、Office 文档和表格</span>
                  <input className='sr-only' type='file' onChange={onSelect} />
                </label>

                {file ? (
                  <div className='mt-2 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm'>
                    <FileText className='size-4 shrink-0 text-muted-foreground' />
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-foreground'>{file.name}</div>
                      <div className='mt-0.5 text-xs text-muted-foreground'>
                        {formatSize(file.size)} · {file.type || 'unknown MIME'}
                      </div>
                    </div>
                    <button
                      aria-label='移除文件'
                      className='text-muted-foreground hover:text-red'
                      type='button'
                      onClick={() => onFile(null)}
                    >
                      <X className='size-3.5' />
                    </button>
                  </div>
                ) : null}
              </Field>

              <Button
                icon={<FileText className='size-4' />}
                type='default'
                onClick={() => {
                  onMode('file')
                  onFile(createSampleFile())
                }}
              >
                载入 Markdown 示例
              </Button>
            </>
          ) : (
            <Field
              hint='API 会在服务端下载文件并按扩展名解析；URL 需要可被当前服务访问。'
              htmlFor='read-file-url'
              label='文件 URL'
            >
              <Input
                id='read-file-url'
                placeholder='https://example.com/report.pdf'
                type='url'
                value={url}
                onChange={(event) => onUrl(event.target.value)}
              />
            </Field>
          )}

          <div className='grid grid-cols-[1fr_auto] gap-2'>
            <Button
              disabled={!canSend}
              icon={<Sparkles className='size-4' />}
              loading={isLoading}
              type='primary'
              onClick={onSubmit}
            >
              开始解析
            </Button>
            <ActionIcon icon={RefreshCcw} title='重置' onClick={onReset} />
          </div>

          <dl className='grid gap-2 border-t border-border pt-4 text-sm'>
            {metaRows(mode, runState).map(([label, value]) => (
              <div key={label} className='flex-between gap-4'>
                <dt className='text-muted-foreground'>{label}</dt>
                <dd className='text-right font-mono text-xs text-foreground'>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Scrollbar>
    </section>
  )
}
