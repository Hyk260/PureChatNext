import { Segmented } from 'antd'
import { Clipboard, Code2, Download, Eye, FileJson, HardDrive, Loader2, Pencil, RefreshCcw, Trash2, X } from 'lucide-react'
import { formatDateTime, formatSize } from '@pure/utils/client'

import { Alert, Button } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'

import { isImageKey, readResult } from './s3Model'
import type { ActionMode, FileInfo, ResultView, S3Result } from './s3Model'

const ICON_BUTTON =
  'rounded-md p-1.5 text-muted-foreground transition hover:bg-hover active:scale-[0.98] disabled:opacity-50'
const ICON_BUTTON_DEFAULT = `${ICON_BUTTON} hover:text-foreground`
const ICON_BUTTON_DANGER = `${ICON_BUTTON} hover:text-red`

function requestStatusAlert(error: string | null, completed: boolean) {
  if (error) return <Alert showIcon description={error} title='请求失败' type='error' />
  if (completed) return <Alert showIcon description='响应已返回，可在下方查看摘要或原始 JSON。' title='请求完成' type='success' />
  return <Alert showIcon description='选择操作并填写参数后发送请求。' title='等待请求' type='info' />
}

function EmptyResult({ description, title }: { description: string; title: string }) {
  return (
    <div className='px-2 py-6 text-center'>
      <FileJson className='mx-auto size-6 text-muted-foreground' />
      <div className='mt-2 text-sm font-semibold text-foreground'>{title}</div>
      <div className='mt-1 text-sm text-muted-foreground'>{description}</div>
    </div>
  )
}

function Stat({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className='min-w-0 rounded-lg bg-secondary px-3 py-2'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className={`mt-1 truncate text-sm text-foreground ${mono ? 'font-mono' : 'font-semibold'}`} title={value}>
        {value}
      </div>
    </div>
  )
}

function ResultBody({
  action,
  payload,
  rawJson,
  view,
}: {
  action: ActionMode | null
  payload: unknown
  rawJson: string
  view: ResultView
}) {
  if (view === 'json') {
    if (!rawJson) return <EmptyResult description='发送请求后会在这里展示原始响应。' title='还没有响应 JSON' />
    return (
      <Highlighter
        actionIconSize='small'
        className='rounded-lg ring-1 ring-border'
        language='json'
        styles={{ content: { height: 'auto' } }}
        variant='borderless'
        wrap
      >
        {rawJson}
      </Highlighter>
    )
  }

  if (payload == null || !action) return null

  const result = readResult(action, payload)
  if (!result) {
    return <EmptyResult description='响应结构和预期不一致，请切换到 JSON 查看。' title='无法解析响应' />
  }
  return <ResultSummary result={result} />
}

function ResultSummary({ result }: { result: S3Result }) {
  if (result.kind === 'upload') {
    return (
      <div className='grid gap-2 sm:grid-cols-3'>
        <Stat label='Key' mono value={result.data.key} />
        <Stat label='大小' value={formatSize(result.data.size)} />
        <Stat label='Content-Type' value={result.data.contentType || 'N/A'} />
      </div>
    )
  }

  if (result.kind === 'list') {
    return <Stat label='匹配文件' value={String(result.data.length)} />
  }

  if (result.kind === 'download') {
    return (
      <div className='grid gap-3'>
        <div className='grid gap-2 sm:grid-cols-2'>
          <Stat label='Key' mono value={result.data.key} />
          <Stat label='有效期' value={`${result.data.expiresIn} 秒`} />
        </div>
        <div className='rounded-lg bg-secondary px-3 py-2'>
          <div className='text-xs text-muted-foreground'>下载链接</div>
          <div className='mt-1 font-mono text-xs leading-5 break-all text-foreground'>{result.data.downloadUrl}</div>
          <Button
            className='mt-3'
            href={result.data.downloadUrl}
            icon={<Download className='size-3.5' />}
            rel='noreferrer'
            size='small'
            target='_blank'
            type='primary'
          >
            打开链接
          </Button>
        </div>
      </div>
    )
  }

  if (result.kind === 'delete') {
    if ('keys' in result.data) return <Stat label='已删除' value={`${result.data.keys.length} 个文件`} />
    return <Stat label='已删除' mono value={result.data.key} />
  }

  return (
    <div className='grid gap-2 sm:grid-cols-2'>
      <Stat label='原 Key' mono value={result.data.oldKey} />
      <Stat label='新 Key' mono value={result.data.newKey} />
    </div>
  )
}

function FileTable({
  files,
  previewLoadingKey,
  onCopyKey,
  onDelete,
  onDownload,
  onPreview,
  onRename,
}: {
  files: FileInfo[]
  onCopyKey: (key: string) => void
  onDelete: (key: string) => void
  onDownload: (key: string) => void
  onPreview: (key: string) => void
  onRename: (key: string) => void
  previewLoadingKey: string | null
}) {
  if (files.length === 0) {
    return (
      <div className='grid flex-1 place-items-center px-6 py-16 text-center'>
        <div>
          <HardDrive className='mx-auto size-8 text-muted-foreground' />
          <div className='mt-3 text-sm font-semibold text-foreground'>还没有文件</div>
          <div className='mt-1 text-sm text-muted-foreground'>上传到 dev/ 后，对象会列在这里。</div>
        </div>
      </div>
    )
  }

  return (
    <table className='w-full text-sm'>
      <thead className='sticky top-0 bg-card'>
        <tr className='border-b border-border text-left text-xs text-muted-foreground'>
          <th className='px-4 py-2 font-medium'>Key</th>
          <th className='hidden px-4 py-2 font-medium sm:table-cell'>大小</th>
          <th className='hidden px-4 py-2 font-medium lg:table-cell'>修改时间</th>
          <th className='px-4 py-2 text-right font-medium'>操作</th>
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr key={file.Key} className='border-b border-border last:border-b-0 hover:bg-hover'>
            <td className='max-w-48 truncate px-4 py-2 font-mono text-xs text-foreground' title={file.Key}>
              {file.Key}
            </td>
            <td className='hidden whitespace-nowrap px-4 py-2 text-xs text-muted-foreground sm:table-cell'>
              {formatSize(file.Size)}
            </td>
            <td className='hidden whitespace-nowrap px-4 py-2 text-xs text-muted-foreground lg:table-cell'>
              {file.LastModified ? formatDateTime(file.LastModified) : 'N/A'}
            </td>
            <td className='px-3 py-1.5'>
              <div className='flex items-center justify-end'>
                {isImageKey(file.Key) ? (
                  <button
                    className={ICON_BUTTON_DEFAULT}
                    disabled={previewLoadingKey === file.Key}
                    title='预览'
                    type='button'
                    onClick={() => onPreview(file.Key)}
                  >
                    {previewLoadingKey === file.Key ? <Loader2 className='size-4 animate-spin' /> : <Eye className='size-4' />}
                  </button>
                ) : null}
                <button className={ICON_BUTTON_DEFAULT} title='下载' type='button' onClick={() => onDownload(file.Key)}>
                  <Download className='size-4' />
                </button>
                <button className={ICON_BUTTON_DEFAULT} title='复制 Key' type='button' onClick={() => onCopyKey(file.Key)}>
                  <Clipboard className='size-4' />
                </button>
                <button className={ICON_BUTTON_DEFAULT} title='重命名' type='button' onClick={() => onRename(file.Key)}>
                  <Pencil className='size-4' />
                </button>
                <button className={ICON_BUTTON_DANGER} title='删除' type='button' onClick={() => onDelete(file.Key)}>
                  <Trash2 className='size-4' />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function S3Results({
  action,
  error,
  files,
  imagePreview,
  onClosePreview,
  onCopyKey,
  onDeleteFile,
  onDownloadFile,
  onPreviewImage,
  onRefresh,
  onRenameFile,
  onViewChange,
  payload,
  previewLoadingKey,
  rawJson,
  view,
}: {
  action: ActionMode | null
  error: string | null
  files: FileInfo[]
  imagePreview: { key: string; url: string } | null
  onClosePreview: () => void
  onCopyKey: (key: string) => void
  onDeleteFile: (key: string) => void
  onDownloadFile: (key: string) => void
  onPreviewImage: (key: string) => void
  onRefresh: () => void
  onRenameFile: (key: string) => void
  onViewChange: (view: ResultView) => void
  payload: unknown
  previewLoadingKey: string | null
  rawJson: string
  view: ResultView
}) {
  return (
    <div className='flex min-h-[32rem] min-w-0 flex-col gap-4 lg:h-full lg:min-h-0'>
      <section className='shrink-0 rounded-card border border-border bg-card p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 flex-1'>{requestStatusAlert(error, payload != null)}</div>
          <Segmented
            options={[
              { label: '结果', value: 'results' },
              {
                label: (
                  <span className='inline-flex items-center gap-1.5'>
                    <Code2 className='size-4' />
                    JSON
                  </span>
                ),
                value: 'json',
              },
            ]}
            size='small'
            value={view}
            onChange={(value) => onViewChange(value as ResultView)}
          />
        </div>
        {view === 'json' || payload != null ? (
          <div className='mt-3'>
            <ResultBody action={action} payload={payload} rawJson={rawJson} view={view} />
          </div>
        ) : null}
      </section>

      <section className='flex min-h-80 flex-1 flex-col overflow-hidden rounded-card border border-border bg-card'>
        <div className='flex items-center justify-between gap-3 border-b border-border px-4 py-3'>
          <div className='min-w-0'>
            <h2 className='text-sm font-semibold text-foreground'>
              存储桶文件
              <span className='ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground'>
                {files.length}
              </span>
            </h2>
            <p className='mt-0.5 text-xs text-muted-foreground'>范围固定在 dev/ 前缀</p>
          </div>
          <Button icon={<RefreshCcw className='size-3.5' />} size='small' onClick={onRefresh}>
            刷新
          </Button>
        </div>
        <Scrollbar className='min-h-0 flex-1'>
          <FileTable
            files={files}
            previewLoadingKey={previewLoadingKey}
            onCopyKey={onCopyKey}
            onDelete={onDeleteFile}
            onDownload={onDownloadFile}
            onPreview={onPreviewImage}
            onRename={onRenameFile}
          />
        </Scrollbar>
      </section>

      {imagePreview ? (
        <div
          aria-label='图片预览'
          aria-modal='true'
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          role='dialog'
          onClick={onClosePreview}
        >
          <div
            className='flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-card bg-card shadow-lg'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex items-center justify-between gap-3 border-b border-border px-4 py-3'>
              <div className='min-w-0 truncate font-mono text-xs text-muted-foreground'>{imagePreview.key}</div>
              <button className={ICON_BUTTON_DEFAULT} title='关闭' type='button' onClick={onClosePreview}>
                <X className='size-4' />
              </button>
            </div>
            <div className='overflow-auto p-4'>
              <img alt={imagePreview.key} className='max-h-[75vh] max-w-full object-contain' src={imagePreview.url} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
