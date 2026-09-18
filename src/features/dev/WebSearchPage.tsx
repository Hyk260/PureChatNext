'use client'

import { useEffect, useMemo, useState } from 'react'
import { Segmented } from 'antd'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Clipboard,
  Code2,
  Compass,
  FileJson,
  Globe2,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import type { CrawlUniformResult, UniformSearchResponse } from '@pure/types'
import { ActionIcon, Alert, Button, Checkbox, Select, TextArea } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

import type { ActionMode, WebSearchCachedForm, WebSearchCachedSlot } from './webSearchCache'
import { clearWebSearchCache, readWebSearchCache, writeWebSearchCacheSlot } from './webSearchCache'

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制',
  copied: '已复制',
  failed: '复制失败',
}
type ResultView = 'summary' | 'json'

type SearchResponse = UniformSearchResponse

type CrawlResponse = {
  results: CrawlUniformResult[]
}

type ApiSuccess = {
  action: ActionMode
  result: SearchResponse | CrawlResponse
  success: true
}

type ApiFailure = {
  error: string
  success: false
}

type SearXNGConfig = {
  engines: Array<{ categories: string[]; enabled: boolean; name: string; timeRangeSupport: boolean }>
}

type WebSearchConfigResponse = {
  configuredProviders?: string[]
  searxng?: SearXNGConfig | null
}

type RunState = {
  durationMs: number
  status: number
  submittedAt: string
}

type CachedSlot = WebSearchCachedSlot<ApiSuccess, RunState>

const SEARCH_PROVIDERS = [
  { label: 'SearXNG', tag: '自部署', value: 'searxng' },
  { label: 'Tavily', tag: 'Key', value: 'tavily' },
  { label: 'Brave', tag: 'Key', value: 'brave' },
  { label: 'Exa', tag: 'Key', value: 'exa' },
  { label: 'Firecrawl', tag: 'Key', value: 'firecrawl' },
  { label: 'Google PSE', tag: 'Key', value: 'google' },
  { label: 'Jina', tag: 'Key', value: 'jina' },
  { label: 'Kagi', tag: 'Key', value: 'kagi' },
  { label: 'Search1API', tag: 'Key', value: 'search1api' },
  { label: 'Bocha · 博查', tag: 'Key', value: 'bocha' },
  { label: 'Anspire · 安思派', tag: 'Key', value: 'anspire' },
] as const

const STATIC_SEARXNG_ENGINES = [
  { categories: ['general', 'web', 'news'], enabled: true, name: 'bing', timeRangeSupport: false },
  { categories: ['news'], enabled: false, name: 'bing news', timeRangeSupport: true },
  { categories: ['images', 'web'], enabled: true, name: 'bing images', timeRangeSupport: true },
  { categories: ['videos', 'web'], enabled: true, name: 'bing videos', timeRangeSupport: true },
  { categories: ['science', 'scientific publications'], enabled: true, name: 'arxiv', timeRangeSupport: false },
  { categories: ['it', 'repos'], enabled: true, name: 'github', timeRangeSupport: false },
  { categories: ['general'], enabled: true, name: 'google', timeRangeSupport: false },
  { categories: ['news'], enabled: false, name: 'google news', timeRangeSupport: false },
  { categories: ['videos'], enabled: true, name: 'bilibili', timeRangeSupport: true },
  { categories: ['general', 'news'], enabled: true, name: 'sogou wechat', timeRangeSupport: false },
] satisfies SearXNGConfig['engines']

const CRAWLER_IMPLS = [
  { label: 'Naive', value: 'naive' },
  { label: 'Jina', value: 'jina' },
  { label: 'Browserless', value: 'browserless' },
  { label: 'Search1API', value: 'search1api' },
  { label: 'Firecrawl', value: 'firecrawl' },
  { label: 'Exa', value: 'exa' },
  { label: 'Tavily', value: 'tavily' },
] as const

const EMPTY_SELECT_VALUE = '__empty__'

const AUTO_PROVIDER_OPTION = {
  label: '自动 · SEARCH_PROVIDERS 链式降级',
  value: EMPTY_SELECT_VALUE,
} as const

const SEARCH_CATEGORY_OPTIONS = [
  { label: '通用 · general', value: 'general' },
  { label: '新闻 · news', value: 'news' },
  { label: '图片 · images', value: 'images' },
  { label: '视频 · videos', value: 'videos' },
  { label: '科学 · science', value: 'science' },
  { label: '文件 · files', value: 'files' },
  { label: '音乐 · music', value: 'music' },
  { label: '社交媒体 · social media', value: 'social media' },
  { label: '地图 · map', value: 'map' },
  { label: 'IT · it', value: 'it' },
] as const

const SEARCH_TIME_RANGE_OPTIONS = [
  { label: '不限 · anytime', value: EMPTY_SELECT_VALUE },
  { label: '一天 · day', value: 'day' },
  { label: '一周 · week', value: 'week' },
  { label: '一月 · month', value: 'month' },
  { label: '一年 · year', value: 'year' },
] as const

const ENGINE_ALL_OPTION = { label: '全部 · All', value: EMPTY_SELECT_VALUE } as const

const segmentedIconLabel = (Icon: typeof Search, text: string, title?: string) => (
  <span className='inline-flex items-center gap-1.5' title={title}>
    <Icon className='size-4 shrink-0' />
    {text}
  </span>
)

const examples = {
  crawlPages: {
    urls: 'https://vercel.com/\nhttps://nextjs.org',
  },
  query: '今日新闻',
  webSearch: '今日新闻',
}

const actionOptions: Array<{
  description: string
  icon: typeof Search
  label: string
  value: ActionMode
}> = [
  {
    description: '调用第一个 provider 的 query 方法',
    icon: Search,
    label: 'Query',
    value: 'query',
  },
  {
    description: '验证聚合搜索、降级重试和 provider fallback',
    icon: Globe2,
    label: 'Web Search',
    value: 'webSearch',
  },
  {
    description: '批量抓取 URL 内容并查看 crawler 输出',
    icon: Compass,
    label: 'Crawl Pages',
    value: 'crawlPages',
  },
]

const ACTION_SEGMENTED_OPTIONS = actionOptions.map((option) => ({
  label: segmentedIconLabel(option.icon, option.label, option.description),
  value: option.value,
}))

const RESULT_VIEW_OPTIONS = [
  { label: segmentedIconLabel(FileJson, '摘要'), value: 'summary' },
  { label: segmentedIconLabel(Code2, 'JSON'), value: 'json' },
]

const parseList = (value: string) => {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const formatNumber = (value: number | undefined) => {
  return typeof value === 'number' ? value.toLocaleString() : 'N/A'
}

const isSearchResponse = (value: SearchResponse | CrawlResponse | null): value is SearchResponse => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'query' in value &&
      typeof value.query === 'string' &&
      'results' in value &&
      Array.isArray(value.results)
  )
}

const isCrawlResponse = (value: SearchResponse | CrawlResponse | null): value is CrawlResponse => {
  return Boolean(value && 'results' in value && Array.isArray(value.results) && !('query' in value))
}

const buildRequestBody = (
  action: ActionMode,
  values: {
    categories: string
    engines: string
    impls: string
    provider: string
    query: string
    timeRange: string
    urls: string
  }
) => {
  if (action === 'crawlPages') {
    const impls = parseList(values.impls)

    return {
      action,
      ...(impls.length > 0 ? { impls } : {}),
      urls: parseList(values.urls),
    }
  }

  const searchCategories = parseList(values.categories)
  const searchEngines = parseList(values.engines)
  const searchTimeRange = values.timeRange.trim()
  const provider = values.provider.trim()

  if (action === 'query') {
    return {
      action,
      params: {
        ...(searchCategories.length > 0 ? { searchCategories } : {}),
        ...(searchEngines.length > 0 ? { searchEngines } : {}),
        ...(searchTimeRange ? { searchTimeRange } : {}),
      },
      ...(provider ? { provider } : {}),
      query: values.query.trim(),
    }
  }

  return {
    action,
    ...(provider ? { provider } : {}),
    ...(searchCategories.length > 0 ? { searchCategories } : {}),
    ...(searchEngines.length > 0 ? { searchEngines } : {}),
    ...(searchTimeRange ? { searchTimeRange } : {}),
    query: values.query.trim(),
  }
}

const defaultQueryForAction = (nextAction: ActionMode) => {
  if (nextAction === 'query') {
    return examples.query
  }

  if (nextAction === 'webSearch') {
    return examples.webSearch
  }

  return examples.webSearch
}

const isConfiguredProviderValue = (value: string, configured: ReadonlySet<string>) => {
  return value === '' || configured.has(value)
}

const resolveProviderValue = (value: string, configured: ReadonlySet<string> | null) => {
  if (!configured) {
    return value
  }

  return isConfiguredProviderValue(value, configured) ? value : ''
}

const selectValue = (value: string) => value || EMPTY_SELECT_VALUE

const fromSelectValue = (value: unknown) => {
  const next = String(value)
  return next === EMPTY_SELECT_VALUE ? '' : next
}

const buildProviderOptions = (configured: ReadonlySet<string>) => [
  AUTO_PROVIDER_OPTION,
  ...SEARCH_PROVIDERS.map((item) => ({
    disabled: !configured.has(item.value),
    label: `${item.label} · ${item.value} · ${item.tag}`,
    value: item.value,
  })),
]

const buildEngineOptions = (engines: SearXNGConfig['engines']) => [
  ENGINE_ALL_OPTION,
  ...engines.map((engine) => ({
    label: engine.timeRangeSupport ? `${engine.name} · time-range` : engine.name,
    value: engine.name,
  })),
]

const crawlerImplClassName = (checked: boolean) => {
  if (checked) {
    return 'flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm text-cyan-900 transition'
  }

  return 'flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white'
}

const requestStatusAlert = (error: string | null, completedAction?: ActionMode) => {
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

export default function WebSearchTestPage() {
  const navigate = useNavigate()
  const [action, setAction] = useState<ActionMode>('webSearch')
  const [view, setView] = useState<ResultView>('summary')
  const [query, setQuery] = useState(examples.webSearch)
  const [provider, setProvider] = useState('')
  const [categories, setCategories] = useState('general')
  const [engines, setEngines] = useState('')
  const [timeRange, setTimeRange] = useState('')
  const [urls, setUrls] = useState(examples.crawlPages.urls)
  const [impls, setImpls] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [payload, setPayload] = useState<ApiSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [searxngConfig, setSearxngConfig] = useState<SearXNGConfig | null>(null)
  const [configuredProviders, setConfiguredProviders] = useState<string[] | null>(null)

  const selectedImpls = useMemo(() => new Set(parseList(impls)), [impls])
  const configuredProviderSet = useMemo(
    () => (configuredProviders ? new Set(configuredProviders) : new Set<string>()),
    [configuredProviders]
  )
  const providerOptions = useMemo(() => buildProviderOptions(configuredProviderSet), [configuredProviderSet])
  const availableEngines = useMemo(() => {
    const source = searxngConfig?.engines ?? STATIC_SEARXNG_ENGINES
    return source.filter((engine) => {
      if (!engine.enabled) return false
      if (categories && !engine.categories.includes(categories)) return false
      if (timeRange && !engine.timeRangeSupport) return false
      return true
    })
  }, [categories, searxngConfig, timeRange])
  const engineOptions = useMemo(() => buildEngineOptions(availableEngines), [availableEngines])

  const requestBody = useMemo(
    () => buildRequestBody(action, { categories, engines, impls, provider, query, timeRange, urls }),
    [action, categories, engines, impls, provider, query, timeRange, urls]
  )

  const result = payload?.result ?? null
  const rawJson = payload ? JSON.stringify(payload, null, 2) : ''
  const requestJson = JSON.stringify(requestBody, null, 2)
  const searchResult = isSearchResponse(result) ? result : null
  const crawlResult = isCrawlResponse(result) ? result : null
  const canSubmit = action === 'crawlPages' ? parseList(urls).length > 0 : query.trim().length > 0

  const applyForm = (form: WebSearchCachedForm) => {
    if (typeof form.query === 'string') {
      setQuery(form.query)
    }
    if (typeof form.provider === 'string') {
      setProvider(resolveProviderValue(form.provider, configuredProviders ? configuredProviderSet : null))
    }
    if (typeof form.categories === 'string') {
      setCategories(form.categories)
    }
    if (typeof form.engines === 'string') {
      setEngines(form.engines)
    }
    if (typeof form.timeRange === 'string') {
      setTimeRange(form.timeRange)
    }
    if (typeof form.urls === 'string') {
      setUrls(form.urls)
    }
    if (typeof form.impls === 'string') {
      setImpls(form.impls)
    }
  }

  const applySlot = (slot: CachedSlot) => {
    setPayload(slot.payload)
    setRunState(slot.runState)
    applyForm(slot.form)
    setError(null)
    setCopyState('idle')
    setView('summary')
  }

  const snapshotForm = (): WebSearchCachedForm => {
    if (action === 'crawlPages') {
      return { impls, urls }
    }

    return { categories, engines, provider, query, timeRange }
  }

  useEffect(() => {
    void apiFetch('/api/admin/web-search')
      .then(async (response) =>
        response.ok ? ((await response.json()) as WebSearchConfigResponse) : null
      )
      .then((config) => {
        const nextConfigured = Array.isArray(config?.configuredProviders)
          ? config.configuredProviders.filter((item): item is string => typeof item === 'string')
          : []
        const configured = new Set(nextConfigured)

        if (config?.searxng) {
          setSearxngConfig(config.searxng)
        }

        setConfiguredProviders(nextConfigured)
        setProvider((current) => resolveProviderValue(current, configured))
      })
      .catch(() => {
        setConfiguredProviders([])
        setProvider((current) => resolveProviderValue(current, new Set()))
      })

    const store = readWebSearchCache<ApiSuccess, RunState>()
    const slot = store.webSearch
    if (slot) {
      // Hydrating a cached form is an intentional one-time state restoration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applySlot(slot)
    }
    // Hydrate once on mount for the default action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleImpl = (value: string) => {
    const next = new Set(selectedImpls)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }

    setImpls(
      CRAWLER_IMPLS.map((item) => item.value)
        .filter((item) => next.has(item))
        .join(',')
    )
  }

  const selectAction = (nextAction: ActionMode) => {
    if (nextAction === action) {
      return
    }

    setAction(nextAction)
    setCopyState('idle')
    setError(null)

    const store = readWebSearchCache<ApiSuccess, RunState>()
    const slot = store[nextAction]

    if (slot) {
      applySlot(slot)
      return
    }

    setPayload(null)
    setRunState(null)

    if (nextAction === 'crawlPages') {
      setUrls(examples.crawlPages.urls)
      return
    }

    setQuery(defaultQueryForAction(nextAction))
  }

  const submit = async () => {
    if (!canSubmit) {
      return
    }

    setIsLoading(true)
    setError(null)
    setPayload(null)
    setCopyState('idle')

    const startedAt = performance.now()
    const submittedAt = new Date().toLocaleString()

    try {
      const response = await apiFetch('/api/admin/web-search', jsonInit(requestBody, { method: 'POST' }))
      const data = (await response.json()) as ApiSuccess | ApiFailure

      const nextRunState: RunState = {
        durationMs: Math.round(performance.now() - startedAt),
        status: response.status,
        submittedAt,
      }

      setRunState(nextRunState)

      if (!response.ok || !data.success) {
        setError('error' in data ? data.error : `Request failed with ${response.status}`)
        return
      }

      setPayload(data)
      setView('summary')
      writeWebSearchCacheSlot(action, {
        form: snapshotForm(),
        payload: data,
        runState: nextRunState,
      })
    } catch (requestError) {
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: 0,
        submittedAt,
      })
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setAction('webSearch')
    setQuery(examples.webSearch)
    setProvider('')
    setCategories('general')
    setEngines('')
    setTimeRange('')
    setUrls(examples.crawlPages.urls)
    setImpls('')
    setPayload(null)
    setError(null)
    setRunState(null)
    setCopyState('idle')
  }

  const clearCache = () => {
    clearWebSearchCache()
    setProvider('')
    setCategories('general')
    setEngines('')
    setTimeRange('')
    setImpls('')
    setPayload(null)
    setError(null)
    setRunState(null)
    setCopyState('idle')
  }

  const copyRequestJson = async () => {
    try {
      await navigator.clipboard.writeText(requestJson)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('failed')
    }
  }

  const currentActionOption = actionOptions.find((option) => option.value === action)
  const resultSummaryItems: Array<[string, string | number | undefined]> = [
    ['Action', payload?.action ?? action],
    ['服务商', searchResult?.provider ?? (provider || undefined)],
    [
      '结果数',
      searchResult ? (searchResult.resultNumbers ?? searchResult.results.length) : crawlResult?.results.length,
    ],
    ['Provider 耗时', searchResult ? `${formatNumber(searchResult.costTime)} ms` : undefined],
    ['HTTP 耗时', runState ? `${runState.durationMs.toLocaleString()} ms` : undefined],
  ]

  const requestStatus = requestStatusAlert(error, payload?.action)

  return (
    <main className='h-screen overflow-x-hidden overflow-y-auto bg-[#f5f7fb] text-slate-950'>
      <div className='mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8'>
        <header className='flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end'>
          <div>
            <div className='mb-3 flex items-center gap-2'>
              <ActionIcon
                aria-label='返回上一页'
                icon={ArrowLeft}
                size='small'
                title='返回上一页'
                onClick={() => navigate(-1)}
              />
              <div className='inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700 ring-1 ring-cyan-200'>
                <Sparkles className='size-4' />
                web-search API tester
              </div>
            </div>
            <h1 className='text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl'>联网搜索功能测试台</h1>
            <p className='mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base'>
              验证 SearchService 的 query、webSearch 和 crawlPages 三条路径，查看请求体、状态、摘要和原始响应。
            </p>
          </div>

          <Segmented
            className='shrink-0'
            options={ACTION_SEGMENTED_OPTIONS}
            value={action}
            onChange={(value) => selectAction(value as ActionMode)}
          />
        </header>

        <div className='grid min-w-0 flex-1 items-start gap-6 lg:grid-cols-[410px_minmax(0,1fr)]'>
          <section className='flex min-w-0 flex-col gap-4'>
            <div className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
              <div className='flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-cyan-900'>
                <Globe2 className='mt-0.5 size-5 shrink-0' />
                <div>
                  <div className='text-sm font-semibold'>{currentActionOption?.label}</div>
                  <div className='mt-1 text-sm leading-5'>{currentActionOption?.description}</div>
                </div>
              </div>

              {action === 'crawlPages' ? (
                <div className='mt-4 grid gap-4'>
                  <div>
                    <label className='text-sm font-medium text-slate-800' htmlFor='web-search-urls'>
                      URL 列表 · URLs
                    </label>
                    <TextArea
                      id='web-search-urls'
                      className='mt-2'
                      placeholder='https://example.com'
                      rows={6}
                      value={urls}
                      onChange={(event) => {
                        setUrls(event.target.value)
                        setError(null)
                      }}
                    />
                    <p className='mt-2 text-xs leading-5 text-slate-500'>每行或逗号分隔一个 URL。</p>
                  </div>

                  <div>
                    <div className='text-sm font-medium text-slate-800' id='web-search-impls-label'>
                      抓取实现 · Crawler impls
                    </div>
                    <div
                      role='group'
                      aria-labelledby='web-search-impls-label'
                      className='mt-2 grid grid-cols-2 gap-2'
                    >
                      {CRAWLER_IMPLS.map((item) => {
                        const checked = selectedImpls.has(item.value)

                        return (
                          <div
                            key={item.value}
                            aria-checked={checked}
                            className={crawlerImplClassName(checked)}
                            role='checkbox'
                            tabIndex={0}
                            onClick={() => toggleImpl(item.value)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return
                              event.preventDefault()
                              toggleImpl(item.value)
                            }}
                          >
                            <Checkbox checked={checked} style={{ pointerEvents: 'none' }} />
                            <span className='min-w-0'>
                              <span className='font-medium'>{item.label}</span>
                              <span className='ml-1 font-mono text-xs text-slate-500'>{item.value}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <p className='mt-2 text-xs leading-5 text-slate-500'>
                      可多选；不选则走服务端默认抓取链路。
                    </p>
                  </div>
                </div>
              ) : (
                <div className='mt-4 grid gap-4'>
                  <div>
                    <label className='text-sm font-medium text-slate-800' htmlFor='web-search-query'>
                      搜索关键词 · Query
                    </label>
                    <TextArea
                      id='web-search-query'
                      className='mt-2'
                      placeholder='输入搜索关键词'
                      rows={3}
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value)
                        setError(null)
                      }}
                    />
                  </div>

                  <div>
                    <label className='text-sm font-medium text-slate-800' htmlFor='web-search-provider'>
                      搜索服务商 · Provider
                    </label>
                    <Select
                      aria-label='搜索服务商'
                      className='mt-2 w-full'
                      options={[...providerOptions]}
                      style={{ width: '100%' }}
                      value={selectValue(provider)}
                      onChange={(value) => setProvider(fromSelectValue(value))}
                    />
                    <p className='mt-2 text-xs leading-5 text-slate-500'>
                      选择后仅调用该服务商；留空则按环境变量顺序尝试并 fallback。
                    </p>
                  </div>

                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div>
                      <label className='text-sm font-medium text-slate-800' htmlFor='web-search-categories'>
                        分类 · Categories
                      </label>
                      <Select
                        aria-label='分类'
                        className='mt-2 w-full'
                        options={[...SEARCH_CATEGORY_OPTIONS]}
                        style={{ width: '100%' }}
                        value={categories}
                        onChange={(value) => {
                          setCategories(String(value))
                          setEngines('')
                        }}
                      />
                    </div>
                    <div>
                      <label className='text-sm font-medium text-slate-800' htmlFor='web-search-engines'>
                        搜索引擎 · Engines
                      </label>
                      <Select
                        aria-label='搜索引擎'
                        className='mt-2 w-full'
                        options={[...engineOptions]}
                        style={{ width: '100%' }}
                        value={selectValue(engines)}
                        onChange={(value) => setEngines(fromSelectValue(value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className='text-sm font-medium text-slate-800' htmlFor='web-search-time-range'>
                      时间范围 · Time range
                    </label>
                    <Select
                      aria-label='时间范围'
                      className='mt-2 w-full'
                      options={[...SEARCH_TIME_RANGE_OPTIONS]}
                      style={{ width: '100%' }}
                      value={selectValue(timeRange)}
                      onChange={(value) => {
                        setTimeRange(fromSelectValue(value))
                        setEngines('')
                      }}
                    />
                  </div>
                </div>
              )}

              <div className='mt-4 grid grid-cols-[1fr_auto_auto] gap-2'>
                <Button
                  disabled={!canSubmit}
                  icon={<Sparkles className='size-4' />}
                  loading={isLoading}
                  type='primary'
                  onClick={() => void submit()}
                >
                  发送请求
                </Button>
                <ActionIcon
                  icon={Trash2}
                  title='清理缓存（结果与服务商/分类/引擎/时间范围/impls）'
                  onClick={clearCache}
                />
                <ActionIcon icon={RefreshCcw} title='重置测试' onClick={reset} />
              </div>
            </div>

            <div className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
              <h2 className='text-sm font-semibold text-slate-950'>请求详情</h2>
              <dl className='mt-3 grid gap-3 text-sm'>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-slate-500'>Endpoint</dt>
                  <dd className='font-mono text-xs text-slate-900'>POST /api/admin/web-search</dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-slate-500'>Action</dt>
                  <dd className='font-mono text-xs text-slate-900'>{action}</dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-slate-500'>状态码</dt>
                  <dd className='font-mono text-xs text-slate-900'>{runState?.status ?? 'N/A'}</dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-slate-500'>耗时</dt>
                  <dd className='font-mono text-xs text-slate-900'>
                    {runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A'}
                  </dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-slate-500'>提交时间</dt>
                  <dd className='text-right text-xs text-slate-900'>{runState?.submittedAt ?? 'N/A'}</dd>
                </div>
              </dl>
            </div>

            <div className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
              <div className='flex items-center justify-between gap-3'>
                <h2 className='text-sm font-semibold text-slate-950'>请求体</h2>
                <Button icon={<Clipboard className='size-3.5' />} size='small' onClick={() => void copyRequestJson()}>
                  {COPY_LABEL[copyState]}
                </Button>
              </div>
              <div className='mt-3'>
                <Scrollbar maxHeight='16rem' className='overflow-hidden rounded-lg ring-1 ring-slate-200'>
                  <Highlighter
                    actionIconSize='small'
                    copyable={false}
                    language='json'
                    showLanguage={false}
                    variant='borderless'
                    wrap
                    styles={{ content: { height: 'auto' } }}
                  >
                    {requestJson}
                  </Highlighter>
                </Scrollbar>
              </div>
            </div>
          </section>

          <section className='flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'>
            <div className='shrink-0 border-b border-slate-200 p-4'>
              {requestStatus}

              <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {resultSummaryItems.map(([label, value]) => (
                  <div key={label} className='rounded-lg border border-slate-200 bg-slate-50 p-3'>
                    <div className='text-xs font-medium text-slate-500'>{label}</div>
                    <div className='mt-1 truncate text-sm font-semibold text-slate-950'>{value ?? 'N/A'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className='flex shrink-0 flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between'>
              <Segmented
                className='shrink-0'
                options={RESULT_VIEW_OPTIONS}
                size='small'
                value={view}
                onChange={(value) => setView(value as ResultView)}
              />
            </div>

            <Scrollbar maxHeight='min(100vh, 60rem)' className='min-h-0'>
              <div className='min-w-0 p-4'>
              {view === 'json' ? (
                rawJson ? (
                  <Highlighter
                    actionIconSize='small'
                    className='rounded-lg ring-1 ring-slate-200'
                    language='json'
                    variant='borderless'
                    wrap
                    styles={{ content: { height: 'auto' } }}
                  >
                    {rawJson}
                  </Highlighter>
                ) : (
                  <div className='grid min-h-40 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center'>
                    <div>
                      <Code2 className='mx-auto size-8 text-slate-400' />
                      <div className='mt-3 text-sm font-semibold text-slate-950'>还没有响应 JSON</div>
                      <div className='mt-1 text-sm text-slate-500'>发送请求后会在这里高亮展示原始响应。</div>
                    </div>
                  </div>
                )
              ) : searchResult ? (
                <div className='grid min-w-0 gap-3'>
                  {searchResult.errorDetail ? (
                    <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm break-words text-amber-800'>
                      {searchResult.errorDetail}
                    </div>
                  ) : null}

                  {searchResult.provider ? (
                    <div className='rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900'>
                      结果来自服务商{' '}
                      <span className='font-semibold font-mono'>{searchResult.provider}</span>
                    </div>
                  ) : null}

                  {searchResult.fallback && searchResult.fallback.level !== 'none' ? (
                    <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
                      搜索已降级：
                      {searchResult.fallback.level === 'engine-removed'
                        ? '指定引擎无结果，已移除引擎限制。'
                        : '仍无结果，已移除分类、引擎和时间范围限制。'}
                    </div>
                  ) : null}

                  {searchResult.results.length > 0 ? (
                    searchResult.results.map((item, index) => (
                      <article
                        key={`${item.url}-${index}`}
                        className='min-w-0 overflow-hidden rounded-lg border border-slate-200 p-4'
                      >
                        <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                          <div className='min-w-0 flex-1 overflow-hidden'>
                            <a
                              href={item.url}
                              target='_blank'
                              rel='noreferrer'
                              className='block text-base font-semibold break-words text-slate-950 hover:text-cyan-700'
                            >
                              {item.title || item.url}
                            </a>
                            <div className='mt-1 truncate font-mono text-xs text-cyan-700' title={item.url}>
                              {item.url}
                            </div>
                          </div>
                          <div className='flex max-w-full shrink-0 flex-wrap gap-1.5 sm:max-w-[40%] sm:justify-end'>
                            {searchResult.provider ? (
                              <span className='rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700'>
                                {searchResult.provider}
                              </span>
                            ) : null}
                            {item.category ? (
                              <span className='rounded-md bg-slate-100 px-2 py-1 text-xs font-medium break-all text-slate-600'>
                                {item.category}
                              </span>
                            ) : null}
                            <span className='rounded-md bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700'>
                              score {formatNumber(item.score)}
                            </span>
                          </div>
                        </div>
                        <p className='mt-3 line-clamp-3 text-sm leading-6 break-words text-slate-600'>{item.content}</p>
                        <div className='mt-3 flex flex-wrap gap-1.5'>
                          {item.engines.map((engine) => (
                            <span
                              key={engine}
                              className='rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium break-all text-slate-500'
                            >
                              {engine}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className='grid min-h-40 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center'>
                      <div>
                        <Search className='mx-auto size-8 text-slate-400' />
                        <div className='mt-3 text-sm font-semibold text-slate-950'>没有搜索结果</div>
                        <div className='mt-1 text-sm text-slate-500'>尝试调整 provider、engine 或关键词。</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : crawlResult ? (
                <div className='grid min-w-0 gap-3'>
                  {crawlResult.results.map((item, index) => {
                    const errorType = 'errorType' in item.data ? item.data.errorType : undefined
                    const errorMessage = 'errorMessage' in item.data ? item.data.errorMessage : undefined
                    const isError = Boolean(errorType || errorMessage)
                    const title = 'title' in item.data ? item.data.title : undefined
                    const contentType = 'contentType' in item.data ? item.data.contentType : undefined

                    return (
                      <article
                        key={`${item.originalUrl}-${index}`}
                        className='min-w-0 overflow-hidden rounded-lg border border-slate-200 p-4'
                      >
                        <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                          <div className='min-w-0 flex-1 overflow-hidden'>
                            <a
                              href={item.originalUrl}
                              target='_blank'
                              rel='noreferrer'
                              className='block text-base font-semibold break-words text-slate-950 hover:text-cyan-700'
                            >
                              {title || item.originalUrl}
                            </a>
                            <div className='mt-1 truncate font-mono text-xs text-cyan-700' title={item.originalUrl}>
                              {item.originalUrl}
                            </div>
                          </div>
                          <div className='flex max-w-full shrink-0 flex-wrap gap-1.5 sm:max-w-[40%] sm:justify-end'>
                            <span className='rounded-md bg-slate-100 px-2 py-1 text-xs font-medium break-all text-slate-600'>
                              {item.crawler}
                            </span>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium break-all ${
                                isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isError ? errorType || 'error' : contentType || 'ok'}
                            </span>
                          </div>
                        </div>
                        <p className='mt-3 line-clamp-5 text-sm leading-6 break-words text-slate-600'>
                          {errorMessage || item.data.content || 'No content returned'}
                        </p>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className='grid min-h-40 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center'>
                  <div>
                    <Globe2 className='mx-auto size-10 text-slate-400' />
                    <div className='mt-3 text-sm font-semibold text-slate-950'>还没有响应</div>
                    <div className='mt-1 text-sm text-slate-500'>发送请求后会展示标准化结果。</div>
                  </div>
                </div>
              )}
              </div>
            </Scrollbar>
          </section>
        </div>
      </div>
    </main>
  )
}
