import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { Clipboard, RefreshCcw, Sparkles, Upload, X } from 'lucide-react'
import { formatSize } from '@pure/utils/client'

import { ActionIcon, Alert, Button, Input, TextArea } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'

import {
  ACTION_META,
  canSubmit,
  COPY_LABEL,
  S3_API_PATH,
} from './s3Model'
import type { ActionMode, CopyState, RunState, S3FormValues } from './s3Model'

const LABEL_CLASS = 'text-sm font-medium text-foreground'

const metaRows = (action: ActionMode, runState: RunState | null): Array<[string, string]> => [
  ['Endpoint', S3_API_PATH],
  ['Action', action],
  ['状态码', runState ? String(runState.status) : 'N/A'],
  ['耗时', runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A'],
  ['提交时间', runState?.submittedAt ?? 'N/A'],
]

function Field({ children, htmlFor, label }: { children: ReactNode; htmlFor?: string; label: string }) {
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
    </div>
  )
}

export function S3Form({
  action,
  copyState,
  files,
  isLoading,
  onChange,
  onCopy,
  onFiles,
  onRemoveFile,
  onReset,
  onSubmit,
  requestJson,
  runState,
  values,
}: {
  action: ActionMode
  copyState: CopyState
  files: File[]
  isLoading: boolean
  onChange: (patch: Partial<S3FormValues>) => void
  onCopy: () => void
  onFiles: (files: File[], replace: boolean) => void
  onRemoveFile: (index: number) => void
  onReset: () => void
  onSubmit: () => void
  requestJson: string
  runState: RunState | null
  values: S3FormValues
}) {
  const canSend = canSubmit(action, values, files.length)

  return (
    <section className='flex min-h-[32rem] flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <Scrollbar className='min-h-0 flex-1'>
        <div className='flex flex-col gap-4 p-4'>
          <p className='text-sm leading-6 text-muted-foreground'>{ACTION_META[action].description}</p>

          {action === 'upload' ? (
            <UploadFields files={files} values={values} onChange={onChange} onFiles={onFiles} onRemoveFile={onRemoveFile} />
          ) : null}
          {action === 'list' ? (
            <Field htmlFor='s3-list-prefix' label='前缀过滤'>
              <Input
                id='s3-list-prefix'
                placeholder='folder/ ，留空列出 dev/ 下全部文件'
                value={values.listPrefix}
                onChange={(event) => onChange({ listPrefix: event.target.value })}
              />
            </Field>
          ) : null}
          {action === 'download' ? <DownloadFields values={values} onChange={onChange} /> : null}
          {action === 'delete' ? (
            <>
              <Field htmlFor='s3-delete-key' label='文件 Key'>
                <Input
                  id='s3-delete-key'
                  placeholder='folder/file.txt'
                  value={values.deleteKey}
                  onChange={(event) => onChange({ deleteKey: event.target.value })}
                />
              </Field>
              <Alert showIcon description='删除后无法从这里恢复。' title='不可逆操作' type='warning' />
            </>
          ) : null}
          {action === 'rename' ? <RenameFields values={values} onChange={onChange} /> : null}

          <div className='grid grid-cols-[1fr_auto] gap-2'>
            <Button
              danger={action === 'delete'}
              disabled={!canSend}
              icon={<Sparkles className='size-4' />}
              loading={isLoading}
              type='primary'
              onClick={onSubmit}
            >
              发送请求
            </Button>
            <ActionIcon icon={RefreshCcw} title='重置' onClick={onReset} />
          </div>

          <dl className='grid gap-2 border-t border-border pt-4 text-sm'>
            {metaRows(action, runState).map(([label, value]) => (
              <div key={label} className='flex-between gap-4'>
                <dt className='text-muted-foreground'>{label}</dt>
                <dd className='text-right font-mono text-xs text-foreground'>{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className='flex-between gap-3'>
              <h2 className='text-sm font-semibold text-foreground'>请求体</h2>
              <Button icon={<Clipboard className='size-3.5' />} size='small' onClick={onCopy}>
                {COPY_LABEL[copyState]}
              </Button>
            </div>
            <Scrollbar maxHeight='10rem' className='mt-3 overflow-hidden rounded-lg ring-1 ring-border'>
              <Highlighter
                actionIconSize='small'
                copyable={false}
                language='json'
                showLanguage={false}
                styles={{ content: { height: 'auto' } }}
                variant='borderless'
                wrap
              >
                {requestJson}
              </Highlighter>
            </Scrollbar>
          </div>
        </div>
      </Scrollbar>
    </section>
  )
}

function UploadFields({
  files,
  onChange,
  onFiles,
  onRemoveFile,
  values,
}: {
  files: File[]
  onChange: (patch: Partial<S3FormValues>) => void
  onFiles: (files: File[], replace: boolean) => void
  onRemoveFile: (index: number) => void
  values: S3FormValues
}) {
  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []), true)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    onFiles(Array.from(event.dataTransfer.files), false)
  }

  return (
    <>
      <Field label='选择文件'>
        <label
          className='flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary px-4 py-6 text-center transition hover:border-primary hover:bg-hover'
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <Upload className='size-6 text-muted-foreground' />
          <span className='text-sm text-muted-foreground'>拖放文件到此处，或点击选择</span>
          <input className='sr-only' type='file' onChange={onSelect} />
        </label>
        {files.length > 1 ? <p className='mt-2 text-xs text-muted-foreground'>一次只上传列表中的第一个文件。</p> : null}
        {files.length > 0 ? (
          <ul className='mt-2 grid gap-1'>
            {files.map((item, index) => (
              <li
                key={`${item.name}-${item.size}-${index}`}
                className='flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm'
              >
                <span className='min-w-0 flex-1 truncate text-foreground'>{item.name}</span>
                <span className='shrink-0 text-xs text-muted-foreground'>{formatSize(item.size)}</span>
                <button
                  aria-label={`移除 ${item.name}`}
                  className='text-muted-foreground hover:text-red'
                  type='button'
                  onClick={() => onRemoveFile(index)}
                >
                  <X className='size-3.5' />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Field>
      <Field htmlFor='s3-upload-key' label='上传路径'>
        <Input
          id='s3-upload-key'
          placeholder='folder/file.txt，实际保存到 dev/ 下'
          value={values.uploadKey}
          onChange={(event) => onChange({ uploadKey: event.target.value })}
        />
      </Field>
      <div className='grid gap-3 rounded-lg bg-secondary p-3'>
        <div className='text-xs font-medium text-muted-foreground'>或写入文本</div>
        <Input
          aria-label='文本文件 Key'
          placeholder='文本 Key，例如 data.json'
          value={values.textKey}
          onChange={(event) => onChange({ textKey: event.target.value })}
        />
        <TextArea
          aria-label='文本内容'
          placeholder='输入文本内容'
          rows={4}
          value={values.textContent}
          onChange={(event) => onChange({ textContent: event.target.value })}
        />
        <Input
          aria-label='Content-Type'
          placeholder='Content-Type，可选，例如 application/json'
          value={values.contentType}
          onChange={(event) => onChange({ contentType: event.target.value })}
        />
      </div>
    </>
  )
}

function DownloadFields({
  onChange,
  values,
}: {
  onChange: (patch: Partial<S3FormValues>) => void
  values: S3FormValues
}) {
  return (
    <>
      <Field htmlFor='s3-download-key' label='文件 Key'>
        <Input
          id='s3-download-key'
          placeholder='folder/file.txt'
          value={values.downloadKey}
          onChange={(event) => onChange({ downloadKey: event.target.value })}
        />
      </Field>
      <Field htmlFor='s3-expires-in' label='链接有效期（秒）'>
        <Input
          id='s3-expires-in'
          inputMode='numeric'
          placeholder='7200'
          value={values.expiresIn}
          onChange={(event) => onChange({ expiresIn: event.target.value })}
        />
      </Field>
    </>
  )
}

function RenameFields({
  onChange,
  values,
}: {
  onChange: (patch: Partial<S3FormValues>) => void
  values: S3FormValues
}) {
  return (
    <>
      <Field htmlFor='s3-rename-old' label='原 Key'>
        <Input
          id='s3-rename-old'
          placeholder='old/path/file.txt'
          value={values.renameOldKey}
          onChange={(event) => onChange({ renameOldKey: event.target.value })}
        />
      </Field>
      <Field htmlFor='s3-rename-new' label='新 Key'>
        <Input
          id='s3-rename-new'
          placeholder='new/path/file.txt'
          value={values.renameNewKey}
          onChange={(event) => onChange({ renameNewKey: event.target.value })}
        />
      </Field>
    </>
  )
}
