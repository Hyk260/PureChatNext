import type { CrawlUniformResult, UniformSearchResponse } from '@pure/types'

import type { ActionMode } from '../webSearchCache'

export type SearchResponse = UniformSearchResponse

export type CrawlResponse = {
  results: CrawlUniformResult[]
}

export type ApiSuccess = {
  action: ActionMode
  result: SearchResponse | CrawlResponse
  success: true
}

export type ApiFailure = {
  error: string
  success: false
}

export type SearXNGEngine = {
  categories: string[]
  enabled: boolean
  name: string
  timeRangeSupport: boolean
}

export type SearXNGConfig = {
  engines: SearXNGEngine[]
}

export type WebSearchConfigResponse = {
  configuredProviders?: string[]
  searxng?: SearXNGConfig | null
}

export type RunState = {
  durationMs: number
  status: number
  submittedAt: string
}

export type ResultView = 'summary' | 'json'

export type CopyState = 'idle' | 'copied' | 'failed'

export type WebSearchFormValues = {
  categories: string
  engines: string
  impls: string
  provider: string
  query: string
  timeRange: string
  urls: string
}

export type SummaryItem = {
  label: string
  value: string
}

export type CrawlItemView = {
  badge: string
  body: string
  crawler: string
  isError: boolean
  title: string
  url: string
}

export const WEB_SEARCH_API_PATH = '/api/admin/web-search'
export const WEB_SEARCH_ENDPOINT_LABEL = 'POST /api/admin/web-search'
export const EMPTY_SELECT_VALUE = '__empty__'
export const EXAMPLE_QUERY = '今日新闻'
export const EXAMPLE_URLS = 'https://vercel.com/\nhttps://nextjs.org'

export const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制',
  copied: '已复制',
  failed: '复制失败',
}

export const ACTION_META: Record<ActionMode, { description: string; label: string }> = {
  crawlPages: {
    description: '批量抓取 URL 内容并查看 crawler 输出',
    label: 'Crawl Pages',
  },
  query: {
    description: '调用第一个 provider 的 query 方法',
    label: 'Query',
  },
  webSearch: {
    description: '验证聚合搜索、降级重试和 provider fallback',
    label: 'Web Search',
  },
}

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
] satisfies SearXNGEngine[]

export const CRAWLER_IMPLS = [
  { label: 'Naive', value: 'naive' },
  { label: 'Jina', value: 'jina' },
  { label: 'Browserless', value: 'browserless' },
  { label: 'Search1API', value: 'search1api' },
  { label: 'Firecrawl', value: 'firecrawl' },
  { label: 'Exa', value: 'exa' },
  { label: 'Tavily', value: 'tavily' },
] as const

export const SEARCH_CATEGORY_OPTIONS = [
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

export const SEARCH_TIME_RANGE_OPTIONS = [
  { label: '不限 · anytime', value: EMPTY_SELECT_VALUE },
  { label: '一天 · day', value: 'day' },
  { label: '一周 · week', value: 'week' },
  { label: '一月 · month', value: 'month' },
  { label: '一年 · year', value: 'year' },
] as const

const FALLBACK_COPY = {
  'all-filters-removed': '仍无结果，已移除分类、引擎和时间范围限制。',
  'engine-removed': '指定引擎无结果，已移除引擎限制。',
} as const

export const parseList = (value: string) => {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const formatNumber = (value: number | undefined) => {
  return typeof value === 'number' ? value.toLocaleString() : 'N/A'
}

export const isSearchResponse = (value: SearchResponse | CrawlResponse | null): value is SearchResponse => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'query' in value &&
      typeof value.query === 'string' &&
      'results' in value &&
      Array.isArray(value.results),
  )
}

export const isCrawlResponse = (value: SearchResponse | CrawlResponse | null): value is CrawlResponse => {
  return Boolean(value && 'results' in value && Array.isArray(value.results) && !('query' in value))
}

export const buildRequestBody = (action: ActionMode, values: WebSearchFormValues) => {
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

export const resolveProviderValue = (value: string, configured: ReadonlySet<string> | null) => {
  if (!configured) return value
  return value === '' || configured.has(value) ? value : ''
}

export const selectValue = (value: string) => value || EMPTY_SELECT_VALUE

export const fromSelectValue = (value: unknown) => {
  const next = String(value)
  return next === EMPTY_SELECT_VALUE ? '' : next
}

export const buildProviderOptions = (configured: ReadonlySet<string>) => [
  { label: '自动 · SEARCH_PROVIDERS 链式降级', value: EMPTY_SELECT_VALUE },
  ...SEARCH_PROVIDERS.map((item) => ({
    disabled: !configured.has(item.value),
    label: `${item.label} · ${item.value} · ${item.tag}`,
    value: item.value,
  })),
]

export const listEngines = (source: SearXNGEngine[] | null | undefined, categories: string, timeRange: string) => {
  const engines = source ?? STATIC_SEARXNG_ENGINES

  return engines.filter((engine) => {
    if (!engine.enabled) return false
    if (categories && !engine.categories.includes(categories)) return false
    if (timeRange && !engine.timeRangeSupport) return false
    return true
  })
}

export const buildEngineOptions = (engines: SearXNGEngine[]) => [
  { label: '全部 · All', value: EMPTY_SELECT_VALUE },
  ...engines.map((engine) => ({
    label: engine.timeRangeSupport ? `${engine.name} · time-range` : engine.name,
    value: engine.name,
  })),
]

export const toggleImplList = (current: string, value: string) => {
  const next = new Set(parseList(current))
  if (next.has(value)) next.delete(value)
  else next.add(value)

  return CRAWLER_IMPLS.map((item) => item.value)
    .filter((item) => next.has(item))
    .join(',')
}

export const searchFallbackCopy = (level: string | undefined) => {
  if (!level || level === 'none') return null
  if (level === 'engine-removed') return FALLBACK_COPY['engine-removed']
  return FALLBACK_COPY['all-filters-removed']
}

const display = (value: string | number | undefined) => {
  if (value === undefined || value === '') return 'N/A'
  return String(value)
}

export const buildResultSummary = (input: {
  action: ActionMode
  crawl: CrawlResponse | null
  payloadAction?: ActionMode
  provider: string
  runState: RunState | null
  search: SearchResponse | null
}): SummaryItem[] => {
  const count = input.search
    ? (input.search.resultNumbers ?? input.search.results.length)
    : input.crawl?.results.length

  return [
    { label: 'Action', value: input.payloadAction ?? input.action },
    { label: '服务商', value: display(input.search?.provider ?? (input.provider || undefined)) },
    { label: '结果数', value: count === undefined ? 'N/A' : count.toLocaleString() },
    {
      label: 'Provider 耗时',
      value: input.search ? `${formatNumber(input.search.costTime)} ms` : 'N/A',
    },
    {
      label: 'HTTP 耗时',
      value: input.runState ? `${input.runState.durationMs.toLocaleString()} ms` : 'N/A',
    },
  ]
}

export const readCrawlItem = (item: CrawlUniformResult): CrawlItemView => {
  const { data } = item
  const errorType = 'errorType' in data ? data.errorType : undefined
  const errorMessage = 'errorMessage' in data ? data.errorMessage : undefined
  const isError = Boolean(errorType || errorMessage)
  const title = 'title' in data ? data.title : undefined
  const contentType = 'contentType' in data ? data.contentType : undefined

  return {
    badge: isError ? errorType || 'error' : contentType || 'ok',
    body: errorMessage || data.content || 'No content returned',
    crawler: item.crawler,
    isError,
    title: title || item.originalUrl,
    url: item.originalUrl,
  }
}

export const canSubmit = (action: ActionMode, values: WebSearchFormValues) => {
  return action === 'crawlPages' ? parseList(values.urls).length > 0 : values.query.trim().length > 0
}
