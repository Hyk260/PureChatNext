import type { ReactNode } from 'react'
import { Clipboard, RefreshCcw, Sparkles, Trash2 } from 'lucide-react'

import { ActionIcon, Button, Checkbox, Select, TextArea } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'

import type { ActionMode } from '../webSearchCache'
import {
  ACTION_META,
  buildEngineOptions,
  buildProviderOptions,
  canSubmit,
  COPY_LABEL,
  CRAWLER_IMPLS,
  fromSelectValue,
  listEngines,
  parseList,
  SEARCH_CATEGORY_OPTIONS,
  SEARCH_TIME_RANGE_OPTIONS,
  selectValue,
  WEB_SEARCH_ENDPOINT_LABEL,
} from './webSearchModel'
import type { CopyState, RunState, SearXNGEngine, WebSearchFormValues } from './webSearchModel'

const LABEL_CLASS = 'text-sm font-medium text-foreground'
const IMPL_ON =
  'flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-secondary px-3 py-2 text-sm text-foreground'
const IMPL_OFF =
  'flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-hover'

const metaRows = (runState: RunState | null): Array<[string, string]> => [
  ['Endpoint', WEB_SEARCH_ENDPOINT_LABEL],
  ['状态码', runState ? String(runState.status) : 'N/A'],
  ['耗时', runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A'],
  ['提交时间', runState?.submittedAt ?? 'N/A'],
]

function Field({
  children,
  hint,
  htmlFor,
  label,
  labelId,
}: {
  children: ReactNode
  hint?: string
  htmlFor?: string
  label: string
  labelId?: string
}) {
  return (
    <div>
      {htmlFor ? (
        <label className={LABEL_CLASS} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className={LABEL_CLASS} id={labelId}>
          {label}
        </div>
      )}
      <div className='mt-2'>{children}</div>
      {hint ? <p className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</p> : null}
    </div>
  )
}

export function WebSearchForm({
  action,
  configuredProviders,
  copyState,
  engines,
  isLoading,
  onChange,
  onClearCache,
  onCopy,
  onReset,
  onSubmit,
  onToggleImpl,
  runState,
  requestJson,
  values,
}: {
  action: ActionMode
  configuredProviders: ReadonlySet<string>
  copyState: CopyState
  engines: SearXNGEngine[] | null
  isLoading: boolean
  onChange: (patch: Partial<WebSearchFormValues>) => void
  onClearCache: () => void
  onCopy: () => void
  onReset: () => void
  onSubmit: () => void
  onToggleImpl: (value: string) => void
  requestJson: string
  runState: RunState | null
  values: WebSearchFormValues
}) {
  const selectedImpls = new Set(parseList(values.impls))
  const providerOptions = buildProviderOptions(configuredProviders)
  const engineOptions = buildEngineOptions(listEngines(engines, values.categories, values.timeRange))
  const canSend = canSubmit(action, values)

  return (
    <section className='flex min-h-[32rem] flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <Scrollbar className='min-h-0 flex-1'>
        <div className='flex flex-col gap-4 p-4'>
          <p className='text-sm leading-6 text-muted-foreground'>{ACTION_META[action].description}</p>

          {action === 'crawlPages' ? (
            <CrawlFields
              selectedImpls={selectedImpls}
              urls={values.urls}
              onToggleImpl={onToggleImpl}
              onUrls={(urls) => onChange({ urls })}
            />
          ) : (
            <SearchFields
              categories={values.categories}
              engineOptions={engineOptions}
              engines={values.engines}
              provider={values.provider}
              providerOptions={providerOptions}
              query={values.query}
              timeRange={values.timeRange}
              onChange={onChange}
            />
          )}

          <div className='grid grid-cols-[1fr_auto_auto] gap-2'>
            <Button
              disabled={!canSend}
              icon={<Sparkles className='size-4' />}
              loading={isLoading}
              type='primary'
              onClick={onSubmit}
            >
              发送请求
            </Button>
            <ActionIcon icon={Trash2} title='清理缓存（结果与服务商/分类/引擎/时间范围/impls）' onClick={onClearCache} />
            <ActionIcon icon={RefreshCcw} title='重置测试' onClick={onReset} />
          </div>

          <dl className='grid gap-2 border-t border-border pt-4 text-sm'>
            {metaRows(runState).map(([label, value]) => (
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

function CrawlFields({
  onToggleImpl,
  onUrls,
  selectedImpls,
  urls,
}: {
  onToggleImpl: (value: string) => void
  onUrls: (value: string) => void
  selectedImpls: ReadonlySet<string>
  urls: string
}) {
  return (
    <>
      <Field hint='每行或逗号分隔一个 URL。' htmlFor='web-search-urls' label='URL 列表 · URLs'>
        <TextArea
          id='web-search-urls'
          placeholder='https://example.com'
          rows={6}
          value={urls}
          onChange={(event) => onUrls(event.target.value)}
        />
      </Field>
      <Field hint='可多选；不选则走服务端默认抓取链路。' label='抓取实现 · Crawler impls' labelId='web-search-impls-label'>
        <div aria-labelledby='web-search-impls-label' className='grid grid-cols-2 gap-2' role='group'>
          {CRAWLER_IMPLS.map((item) => {
            const checked = selectedImpls.has(item.value)
            return (
              <div
                key={item.value}
                aria-checked={checked}
                className={checked ? IMPL_ON : IMPL_OFF}
                role='checkbox'
                tabIndex={0}
                onClick={() => onToggleImpl(item.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onToggleImpl(item.value)
                }}
              >
                <Checkbox checked={checked} style={{ pointerEvents: 'none' }} />
                <span className='min-w-0 leading-5'>
                  <span className='block truncate font-medium'>{item.label}</span>
                  <span className='block truncate font-mono text-xs text-muted-foreground'>{item.value}</span>
                </span>
              </div>
            )
          })}
        </div>
      </Field>
    </>
  )
}

function SearchFields({
  categories,
  engineOptions,
  engines,
  onChange,
  provider,
  providerOptions,
  query,
  timeRange,
}: {
  categories: string
  engineOptions: ReturnType<typeof buildEngineOptions>
  engines: string
  onChange: (patch: Partial<WebSearchFormValues>) => void
  provider: string
  providerOptions: ReturnType<typeof buildProviderOptions>
  query: string
  timeRange: string
}) {
  return (
    <>
      <Field htmlFor='web-search-query' label='搜索关键词 · Query'>
        <TextArea
          id='web-search-query'
          placeholder='输入搜索关键词'
          rows={3}
          value={query}
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </Field>
      <Field
        hint='选择后仅调用该服务商；留空则按环境变量顺序尝试并 fallback。'
        htmlFor='web-search-provider'
        label='搜索服务商 · Provider'
      >
        <Select
          aria-label='搜索服务商'
          className='w-full'
          options={[...providerOptions]}
          style={{ width: '100%' }}
          value={selectValue(provider)}
          onChange={(value) => onChange({ provider: fromSelectValue(value) })}
        />
      </Field>
      <div className='grid gap-3 sm:grid-cols-2'>
        <Field htmlFor='web-search-categories' label='分类 · Categories'>
          <Select
            aria-label='分类'
            className='w-full'
            options={[...SEARCH_CATEGORY_OPTIONS]}
            style={{ width: '100%' }}
            value={categories}
            onChange={(value) => onChange({ categories: String(value), engines: '' })}
          />
        </Field>
        <Field htmlFor='web-search-engines' label='搜索引擎 · Engines'>
          <Select
            aria-label='搜索引擎'
            className='w-full'
            options={[...engineOptions]}
            style={{ width: '100%' }}
            value={selectValue(engines)}
            onChange={(value) => onChange({ engines: fromSelectValue(value) })}
          />
        </Field>
      </div>
      <Field htmlFor='web-search-time-range' label='时间范围 · Time range'>
        <Select
          aria-label='时间范围'
          className='w-full'
          options={[...SEARCH_TIME_RANGE_OPTIONS]}
          style={{ width: '100%' }}
          value={selectValue(timeRange)}
          onChange={(value) => onChange({ engines: '', timeRange: fromSelectValue(value) })}
        />
      </Field>
    </>
  )
}
