export const SEARCH_PROVIDER_IDS = [
  'anspire',
  'bocha',
  'brave',
  'exa',
  'firecrawl',
  'google',
  'jina',
  'kagi',
  'search1api',
  'searxng',
  'tavily',
] as const
export const FETCH_PROVIDER_IDS = ['browserless', 'exa', 'firecrawl', 'jina', 'naive', 'search1api', 'tavily'] as const
export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number]
export type FetchProviderId = (typeof FETCH_PROVIDER_IDS)[number]
export type WebProviderId = SearchProviderId | FetchProviderId
export type WebCapability = 'search' | 'fetch'

export type WebProviderConfig = {
  apiKeys?: string[]
  searchBaseURL?: string
  fetchBaseURL?: string
  engineId?: string
  basicAuthUsername?: string
  basicAuthPassword?: string
}

export type WebSearchSettings = {
  searchProvider?: SearchProviderId
  fetchProvider?: FetchProviderId
  maxResults?: number
  compression?: 'none' | 'cutoff'
  cutoffLimit?: number
  blacklist?: string[]
  modelToolsPreferred?: boolean
  providers?: Partial<Record<WebProviderId, WebProviderConfig>>
}

export type WebSearchSettingsPatch = {
  [K in Exclude<keyof WebSearchSettings, 'providers'>]?: WebSearchSettings[K] | null
} & {
  providers?: Partial<Record<WebProviderId, { [K in keyof WebProviderConfig]?: WebProviderConfig[K] | null } | null>>
}

export const DEFAULT_WEB_SEARCH_SETTINGS = {
  maxResults: 5,
  compression: 'cutoff',
  cutoffLimit: 2000,
  blacklist: [] as string[],
  modelToolsPreferred: true,
} as const

export const WEB_PROVIDER_CATALOG: Record<
  WebProviderId,
  {
    name: string
    website: string
    description: string
    searchBaseURL?: string
    fetchBaseURL?: string
  }
> = {
  anspire: {
    name: 'Anspire',
    website: 'https://open.anspire.cn',
    description: 'Anspire 联网搜索服务。',
    searchBaseURL: 'https://plugin.anspire.cn/api',
  },
  bocha: {
    name: 'Bocha',
    website: 'https://open.bochaai.com',
    description: '博查中文网页搜索服务。',
    searchBaseURL: 'https://api.bochaai.com/v1',
  },
  brave: {
    name: 'Brave',
    website: 'https://brave.com/search/api/',
    description: 'Brave 独立网页索引搜索。',
    searchBaseURL: 'https://api.search.brave.com/res/v1',
  },
  exa: {
    name: 'Exa',
    website: 'https://dashboard.exa.ai',
    description: 'Exa 网页搜索与内容提取。',
    searchBaseURL: 'https://api.exa.ai',
    fetchBaseURL: 'https://api.exa.ai',
  },
  firecrawl: {
    name: 'Firecrawl',
    website: 'https://www.firecrawl.dev',
    description: '网页搜索与抓取，将网页转换为 Markdown。',
    searchBaseURL: 'https://api.firecrawl.dev/v2',
    fetchBaseURL: 'https://api.firecrawl.dev/v2',
  },
  google: {
    name: 'Google',
    website: 'https://programmablesearchengine.google.com',
    description: 'Google 可编程搜索引擎，需要 API Key 和搜索引擎 ID。',
    searchBaseURL: 'https://www.googleapis.com',
  },
  jina: {
    name: 'Jina',
    website: 'https://jina.ai',
    description: 'Jina Search 与 Reader 网页内容读取。',
    searchBaseURL: 'https://s.jina.ai',
    fetchBaseURL: 'https://r.jina.ai',
  },
  kagi: {
    name: 'Kagi',
    website: 'https://kagi.com',
    description: 'Kagi 网页搜索服务。',
    searchBaseURL: 'https://kagi.com/api/v0',
  },
  search1api: {
    name: 'Search1API',
    website: 'https://www.search1api.com',
    description: '统一的搜索与网页内容提取 API。',
    searchBaseURL: 'https://api.search1api.com',
    fetchBaseURL: 'https://api.search1api.com',
  },
  searxng: {
    name: 'SearXNG',
    website: 'https://docs.searxng.org',
    description: '自托管元搜索引擎，实例需启用 JSON 输出。',
  },
  tavily: {
    name: 'Tavily',
    website: 'https://app.tavily.com',
    description: '面向 AI 的实时搜索与网页提取。',
    searchBaseURL: 'https://api.tavily.com',
    fetchBaseURL: 'https://api.tavily.com',
  },
  browserless: {
    name: 'Browserless',
    website: 'https://www.browserless.io',
    description: '通过浏览器渲染读取动态网页。',
    fetchBaseURL: 'https://chrome.browserless.io',
  },
  naive: { name: '内置抓取', website: '', description: '直接读取公开网页并提取正文，无需 API 密钥。' },
}

export type WebSearchSettingsResponse = {
  settings: WebSearchSettings
  server: {
    searchProviders: string[]
    fetchProviders: string[]
    providers: Partial<
      Record<
        WebProviderId,
        {
          hasApiKey: boolean
          hasSearchApiKey?: boolean
          hasFetchApiKey?: boolean
          searchBaseURL?: string
          fetchBaseURL?: string
          engineId?: string
        }
      >
    >
  }
}

export type ChatFetchUrlsToolResult = {
  success: boolean
  query: string
  results: Array<{ url: string; title: string; content: string }>
  errors: Array<{ url: string; error: string }>
}
