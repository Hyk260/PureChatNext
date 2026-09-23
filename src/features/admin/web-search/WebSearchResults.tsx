import type { ReactNode } from 'react'
import { Segmented } from 'antd'
import { Code2, FileJson, Globe2, Search } from 'lucide-react'

import { Alert, Flex } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'

import type { ActionMode } from '../webSearchCache'
import {
  buildResultSummary,
  formatNumber,
  isCrawlResponse,
  isSearchResponse,
  readCrawlItem,
  searchFallbackCopy,
} from './webSearchModel'
import type { ApiSuccess, CrawlResponse, ResultView, RunState, SearchResponse } from './webSearchModel'

const BODY_CLASS = 'mt-3 text-sm leading-6 break-words text-muted-foreground'
const TAG_CLASS = 'rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground'
const TAG_ERROR_CLASS = 'rounded-md bg-red-tint px-2 py-1 text-xs font-medium text-red'
const ENGINE_CLASS =
  'rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground'

const segmentedIconLabel = (Icon: typeof Search, text: string) => (
  <span className='inline-flex items-center gap-1.5'>
    <Icon className='size-4 shrink-0' />
    {text}
  </span>
)

const RESULT_VIEW_OPTIONS = [
  { label: segmentedIconLabel(FileJson, '摘要'), value: 'summary' },
  { label: segmentedIconLabel(Code2, 'JSON'), value: 'json' },
]

function requestStatusAlert(error: string | null, completedAction?: ActionMode) {
  if (error) {
    return <Alert showIcon description={error} title='请求失败' type='error' />
  }

  if (completedAction) {
    return (
      <Alert
        showIcon
        description={`${completedAction} 返回成功，下面可查看摘要与原始 JSON。`}
        title='请求完成'
        type='success'
      />
    )
  }

  return <Alert showIcon description='选择方法并填写参数后发送请求，响应会显示在这里。' title='等待请求' type='info' />
}

function EmptyResult({
  description,
  icon: Icon,
  title,
}: {
  description: string
  icon: typeof Search
  title: string
}) {
  return (
    <div className='grid min-h-40 place-items-center px-6 py-10 text-center'>
      <div>
        <Icon className='mx-auto size-8 text-muted-foreground' />
        <div className='mt-3 text-sm font-semibold text-foreground'>{title}</div>
        <div className='mt-1 text-sm text-muted-foreground'>{description}</div>
      </div>
    </div>
  )
}

function ResultArticle({
  badges,
  body,
  clamp,
  engines,
  title,
  url,
}: {
  badges: ReactNode
  body: string
  clamp: 'line-clamp-3' | 'line-clamp-5'
  engines?: string[]
  title: string
  url: string
}) {
  const bodyClass = clamp === 'line-clamp-5' ? `${BODY_CLASS} line-clamp-5` : `${BODY_CLASS} line-clamp-3`

  return (
    <article className='py-4'>
      <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 flex-1'>
          <a
            className='block text-base font-semibold break-words text-foreground hover:text-primary'
            href={url}
            rel='noreferrer'
            target='_blank'
          >
            {title}
          </a>
          <div className='mt-1 truncate font-mono text-xs text-primary' title={url}>
            {url}
          </div>
        </div>
        <div className='flex max-w-full shrink-0 flex-wrap gap-1.5 sm:max-w-[40%] sm:justify-end'>{badges}</div>
      </div>
      <p className={bodyClass}>{body}</p>
      {engines && engines.length > 0 ? (
        <div className='mt-3 flex flex-wrap gap-1.5'>
          {engines.map((engine) => (
            <span key={engine} className={ENGINE_CLASS}>
              {engine}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function SearchList({ result }: { result: SearchResponse }) {
  const fallback = searchFallbackCopy(result.fallback?.level)

  return (
    <div>
      {result.errorDetail ? <p className='mb-3 rounded-lg bg-red-tint px-3 py-2 text-sm text-red'>{result.errorDetail}</p> : null}
      {result.provider ? (
        <p className='mb-3 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground'>
          结果来自服务商 <span className='font-mono font-semibold'>{result.provider}</span>
        </p>
      ) : null}
      {fallback ? (
        <p className='mb-3 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground'>搜索已降级：{fallback}</p>
      ) : null}

      {result.results.length > 0 ? (
        <div className='divide-y divide-border'>
          {result.results.map((item, index) => (
            <ResultArticle
              key={`${item.url}-${index}`}
              badges={
                <>
                  {result.provider ? <span className={TAG_CLASS}>{result.provider}</span> : null}
                  {item.category ? <span className={TAG_CLASS}>{item.category}</span> : null}
                  <span className={TAG_CLASS}>score {formatNumber(item.score)}</span>
                </>
              }
              body={item.content}
              clamp='line-clamp-3'
              engines={item.engines}
              title={item.title || item.url}
              url={item.url}
            />
          ))}
        </div>
      ) : (
        <EmptyResult description='尝试调整 provider、engine 或关键词。' icon={Search} title='没有搜索结果' />
      )}
    </div>
  )
}

function CrawlList({ result }: { result: CrawlResponse }) {
  return (
    <div className='divide-y divide-border'>
      {result.results.map((item, index) => {
        const view = readCrawlItem(item)
        return (
          <ResultArticle
            key={`${view.url}-${index}`}
            badges={
              <>
                <span className={TAG_CLASS}>{view.crawler}</span>
                <span className={view.isError ? TAG_ERROR_CLASS : TAG_CLASS}>{view.badge}</span>
              </>
            }
            body={view.body}
            clamp='line-clamp-5'
            title={view.title}
            url={view.url}
          />
        )
      })}
    </div>
  )
}

function ResultBody({
  payload,
  rawJson,
  view,
}: {
  payload: ApiSuccess | null
  rawJson: string
  view: ResultView
}) {
  if (view === 'json') {
    if (!rawJson) {
      return <EmptyResult description='发送请求后会在这里高亮展示原始响应。' icon={Code2} title='还没有响应 JSON' />
    }

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

  const result = payload?.result ?? null
  if (isSearchResponse(result)) return <SearchList result={result} />
  if (isCrawlResponse(result)) return <CrawlList result={result} />
  return <EmptyResult description='发送请求后会展示标准化结果。' icon={Globe2} title='还没有响应' />
}

export function WebSearchResults({
  action,
  error,
  onViewChange,
  payload,
  provider,
  rawJson,
  runState,
  view,
}: {
  action: ActionMode
  error: string | null
  onViewChange: (view: ResultView) => void
  payload: ApiSuccess | null
  provider: string
  rawJson: string
  runState: RunState | null
  view: ResultView
}) {
  const result = payload?.result ?? null
  const summary = buildResultSummary({
    action,
    crawl: isCrawlResponse(result) ? result : null,
    payloadAction: payload?.action,
    provider,
    runState,
    search: isSearchResponse(result) ? result : null,
  })

  return (
    <section className='flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <Flex className='gap-2 shrink-0 flex-col space-y-3 border-b border-border p-4'>
        {requestStatusAlert(error, payload?.action)}
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <dl className='grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5'>
            {summary.map((item) => (
              <div key={item.label} className='rounded-lg bg-secondary px-3 py-2'>
                <dt className='text-xs text-muted-foreground'>{item.label}</dt>
                <dd className='mt-1 truncate text-sm font-semibold text-foreground'>{item.value}</dd>
              </div>
            ))}
          </dl>
          <Segmented
            className='shrink-0'
            options={RESULT_VIEW_OPTIONS}
            size='small'
            value={view}
            onChange={(value) => onViewChange(value as ResultView)}
          />
        </div>
      </Flex>
      <Scrollbar className='min-h-0 flex-1'>
        <div className='min-w-0 p-4'>
          <ResultBody payload={payload} rawJson={rawJson} view={view} />
        </div>
      </Scrollbar>
    </section>
  )
}
