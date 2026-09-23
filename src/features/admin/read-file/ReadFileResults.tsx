import { Segmented } from 'antd'
import { Clipboard, Code2, Download, FileJson, FileText, Layers } from 'lucide-react'

import type { DocumentPage, FileDocument } from '@pure/file-loaders'
import { Alert, Button } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'

import {
  COPY_LABEL,
  RESULT_VIEW_LABEL,
  pageTitle,
  resultSummaryItems,
  summarizeValue,
} from './readFileModel'
import type { CopyState, ResultView } from './readFileModel'

const segmentedIconLabel = (Icon: typeof FileText, text: string) => (
  <span className='inline-flex items-center gap-1.5'>
    <Icon className='size-4 shrink-0' />
    {text}
  </span>
)

function resultViewOptions(pageCount: number) {
  return [
    { label: segmentedIconLabel(FileText, RESULT_VIEW_LABEL.content), value: 'content' },
    {
      label: segmentedIconLabel(Layers, pageCount > 0 ? `${RESULT_VIEW_LABEL.pages} ${pageCount}` : RESULT_VIEW_LABEL.pages),
      value: 'pages',
    },
    { label: segmentedIconLabel(Code2, RESULT_VIEW_LABEL.json), value: 'json' },
  ]
}

function requestStatusAlert(error: string | null, result: FileDocument | null) {
  if (error) return <Alert showIcon description={error} title='解析失败' type='error' />
  if (result) {
    return (
      <Alert
        showIcon
        description={`已读取 ${summarizeValue(result.filename)}，共 ${summarizeValue(result.totalCharCount)} 字符。`}
        title='解析完成'
        type='success'
      />
    )
  }
  return <Alert showIcon description='选择文件或输入 URL 后开始解析，响应会显示在这里。' title='等待测试' type='info' />
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 rounded-lg bg-secondary px-3 py-2'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 truncate text-sm font-semibold text-foreground' title={value}>
        {value}
      </div>
    </div>
  )
}

function EmptyResult({ description, title }: { description: string; title: string }) {
  return (
    <div className='grid min-h-40 place-items-center px-6 py-10 text-center'>
      <div>
        <FileJson className='mx-auto size-8 text-muted-foreground' />
        <div className='mt-3 text-sm font-semibold text-foreground'>{title}</div>
        <div className='mt-1 text-sm text-muted-foreground'>{description}</div>
      </div>
    </div>
  )
}

function PageCard({ index, page }: { index: number; page: DocumentPage }) {
  return (
    <article className='overflow-hidden rounded-lg border border-border'>
      <div className='flex flex-col gap-1 border-b border-border bg-secondary px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
        <h3 className='text-sm font-semibold text-foreground'>{pageTitle(page, index)}</h3>
        <div className='text-xs text-muted-foreground'>
          {summarizeValue(page.charCount)} chars · {summarizeValue(page.lineCount)} lines
        </div>
      </div>
      <pre className='max-h-64 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-foreground'>
        {page.pageContent || 'No page content.'}
      </pre>
    </article>
  )
}

function ResultBody({
  pages,
  rawJson,
  result,
  view,
}: {
  pages: DocumentPage[]
  rawJson: string
  result: FileDocument | null
  view: ResultView
}) {
  if (view === 'json') {
    if (!rawJson) return <EmptyResult description='解析完成后会在这里展示原始响应。' title='还没有响应 JSON' />
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

  if (view === 'pages') {
    if (pages.length === 0) {
      return <EmptyResult description='当前结果没有分页 / 分块数据。' title='暂无分页数据' />
    }
    return (
      <div className='grid gap-3'>
        {pages.map((page, index) => (
          <PageCard key={`${pageTitle(page, index)}-${index}`} index={index} page={page} />
        ))}
      </div>
    )
  }

  if (!result?.content) {
    return <EmptyResult description='解析后的聚合内容会显示在这里。' title='等待内容' />
  }

  return (
    <pre className='overflow-auto whitespace-pre-wrap rounded-lg bg-secondary p-4 font-mono text-sm leading-6 text-foreground ring-1 ring-border'>
      {result.content}
    </pre>
  )
}

export function ReadFileResults({
  copyState,
  error,
  onCopy,
  onDownload,
  onViewChange,
  rawJson,
  result,
  view,
}: {
  copyState: CopyState
  error: string | null
  onCopy: () => void
  onDownload: () => void
  onViewChange: (view: ResultView) => void
  rawJson: string
  result: FileDocument | null
  view: ResultView
}) {
  const pages = result?.pages ?? []
  const hasJson = Boolean(rawJson)

  return (
    <section className='flex min-h-[32rem] flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <div className='shrink-0 space-y-3 border-b border-border p-4'>
        {requestStatusAlert(error, result)}
        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
          {resultSummaryItems(result).map((item) => (
            <Stat key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>

      <div className='flex shrink-0 flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between'>
        <Segmented options={resultViewOptions(pages.length)} value={view} onChange={(value) => onViewChange(value as ResultView)} />
        <div className='flex gap-2'>
          <Button disabled={!hasJson} icon={<Clipboard className='size-3.5' />} size='small' onClick={onCopy}>
            {COPY_LABEL[copyState]}
          </Button>
          <Button disabled={!hasJson} icon={<Download className='size-3.5' />} size='small' onClick={onDownload}>
            下载
          </Button>
        </div>
      </div>

      <Scrollbar className='min-h-0 flex-1'>
        <div className='p-4'>
          <ResultBody pages={pages} rawJson={rawJson} result={result} view={view} />
        </div>
      </Scrollbar>
    </section>
  )
}
