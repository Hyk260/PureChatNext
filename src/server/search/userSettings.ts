import { DEFAULT_WEB_SEARCH_SETTINGS, FETCH_PROVIDER_IDS, SEARCH_PROVIDER_IDS, WEB_PROVIDER_CATALOG } from '@pure/types'
import type { WebCapability, WebProviderId, WebSearchSettings, WebSearchSettingsResponse } from '@pure/types'
import type { CrawlImplType, CrawlProviderOptions } from '@pure/web-crawler'

import { getJinaReaderBaseUrl, getJinaSearchBaseUrl } from '@pure/utils'

import { toolsEnv } from '@/envs/tools'
import { createTimedFetch } from '@/libs/ai-providers/timedFetch'

import { parseImplEnv, SearchService } from './index'
import type { SearchImplType } from './impls'
import type { SearchProviderOptions } from './impls/type'

export const providerEnvKey = (id: WebProviderId, capability: WebCapability) => {
  const keys: Partial<Record<WebProviderId, string | undefined>> = {
    anspire: toolsEnv.ANSPIRE_API_KEY,
    bocha: toolsEnv.BOCHA_API_KEY,
    brave: toolsEnv.BRAVE_API_KEY,
    exa: toolsEnv.EXA_API_KEY,
    firecrawl: toolsEnv.FIRECRAWL_API_KEY,
    google: toolsEnv.GOOGLE_PSE_API_KEY,
    jina: toolsEnv.JINA_READER_API_KEY || toolsEnv.JINA_API_KEY,
    kagi: toolsEnv.KAGI_API_KEY,
    search1api:
      (capability === 'search' ? toolsEnv.SEARCH1API_SEARCH_API_KEY : toolsEnv.SEARCH1API_CRAWL_API_KEY) ||
      toolsEnv.SEARCH1API_API_KEY,
    tavily: toolsEnv.TAVILY_API_KEY,
    browserless: toolsEnv.BROWSERLESS_TOKEN,
  }
  return keys[id]?.trim()
}

export const providerEnvURL = (id: WebProviderId, capability: WebCapability) => {
  if (id === 'searxng') return toolsEnv.SEARXNG_URL
  if (id === 'firecrawl') return toolsEnv.FIRECRAWL_URL || WEB_PROVIDER_CATALOG[id][`${capability}BaseURL`]
  if (id === 'browserless') return toolsEnv.BROWSERLESS_URL || WEB_PROVIDER_CATALOG[id].fetchBaseURL
  if (id === 'jina' && toolsEnv.JINA_USE_CN_DOMAINS === 'true')
    return capability === 'search' ? getJinaSearchBaseUrl(true) : getJinaReaderBaseUrl(true)
  return WEB_PROVIDER_CATALOG[id][`${capability}BaseURL`]
}

export const configuredSearchProviders = () => {
  const ids = parseImplEnv(toolsEnv.SEARCH_PROVIDERS).filter((id) =>
    (SEARCH_PROVIDER_IDS as readonly string[]).includes(id)
  )
  return ids.length ? ids : ['searxng']
}
export const configuredFetchProviders = () => {
  const ids = parseImplEnv(toolsEnv.CRAWLER_IMPLS).filter((id) =>
    (FETCH_PROVIDER_IDS as readonly string[]).includes(id)
  )
  return ids.length ? ids : ['jina', 'naive', 'search1api', 'browserless']
}

const publicEndpoint = (value?: string) => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

export function serverWebSearchConfig(): WebSearchSettingsResponse['server'] {
  const providers: WebSearchSettingsResponse['server']['providers'] = {}
  for (const id of Object.keys(WEB_PROVIDER_CATALOG) as WebProviderId[]) {
    providers[id] = {
      hasApiKey: Boolean(providerEnvKey(id, 'search') || providerEnvKey(id, 'fetch')),
      hasSearchApiKey: Boolean(providerEnvKey(id, 'search')),
      hasFetchApiKey: Boolean(providerEnvKey(id, 'fetch')),
      searchBaseURL: publicEndpoint(providerEnvURL(id, 'search')),
      fetchBaseURL: publicEndpoint(providerEnvURL(id, 'fetch')),
      ...(id === 'google' ? { engineId: toolsEnv.GOOGLE_PSE_ENGINE_ID } : {}),
    }
  }
  return { providers, searchProviders: configuredSearchProviders(), fetchProviders: configuredFetchProviders() }
}

// ponytail: process-local rotation; each server instance advances independently.
const keyCursors = new Map<string, number>()
export function rotateWebKey(owner: string, provider: string, keys: string[]) {
  if (!keys.length) return undefined
  const id = `${owner}:${provider}`
  const index = (keyCursors.get(id) ?? 0) % keys.length
  if (keyCursors.size > 10000) keyCursors.clear()
  keyCursors.set(id, index + 1)
  return keys[index]
}

export function resolveWebProviderOptions(
  settings: WebSearchSettings,
  id: WebProviderId,
  capability: WebCapability,
  userKey?: string,
  useUserConfig = true
): SearchProviderOptions {
  const config = useUserConfig ? (settings.providers?.[id] ?? {}) : {}
  const baseURL = config[`${capability}BaseURL`]?.replace(/\/+$/, '') || providerEnvURL(id, capability)
  const envKey = providerEnvKey(id, capability)
  const serverURL = providerEnvURL(id, capability)?.replace(/\/+$/, '')
  const activeUserKey = useUserConfig ? userKey : undefined
  if (baseURL !== serverURL && envKey && !activeUserKey) throw new Error('自定义 API 地址需要填写自己的 API 密钥')
  return {
    apiKey: activeUserKey ?? envKey ?? '',
    baseURL,
    engineId: config.engineId || toolsEnv.GOOGLE_PSE_ENGINE_ID,
    basicAuthUsername: config.basicAuthUsername,
    basicAuthPassword: config.basicAuthPassword,
    fetch: createTimedFetch(15000),
  }
}

export async function loadWebSearchSettings(userId?: string | null): Promise<WebSearchSettings> {
  if (!userId) return {}
  const { WebSearchSettingsModel } = await import('@pure/database/models/webSearchSettings')
  return new WebSearchSettingsModel().get(userId)
}

export function createUserSearchService(
  settings: WebSearchSettings,
  owner: string,
  capability?: WebCapability
): SearchService {
  const searchIds = settings.searchProvider ? [settings.searchProvider] : configuredSearchProviders()
  const fetchIds = settings.fetchProvider ? [settings.fetchProvider] : configuredFetchProviders()
  const activeSearchIds = capability === 'fetch' ? [] : searchIds
  const activeFetchIds = capability === 'search' ? [] : fetchIds
  const keys = new Map<WebProviderId, string | undefined>()
  const keyFor = (id: WebProviderId, providerCapability: WebCapability) => {
    const selected = providerCapability === 'search' ? settings.searchProvider : settings.fetchProvider
    if (!selected) return undefined
    if (!keys.has(id)) keys.set(id, rotateWebKey(owner, id, settings.providers?.[id]?.apiKeys ?? []))
    return keys.get(id)
  }
  const providers: Partial<Record<SearchImplType, SearchProviderOptions>> = {}
  const crawlerConfigs: Partial<Record<CrawlImplType, CrawlProviderOptions>> = {}
  for (const id of activeSearchIds as SearchImplType[])
    providers[id] = resolveWebProviderOptions(
      settings,
      id,
      'search',
      keyFor(id, 'search'),
      Boolean(settings.searchProvider)
    )
  for (const id of activeFetchIds as CrawlImplType[])
    crawlerConfigs[id] = resolveWebProviderOptions(
      settings,
      id,
      'fetch',
      keyFor(id, 'fetch'),
      Boolean(settings.fetchProvider)
    )
  return new SearchService({
    searchProviders: searchIds as SearchImplType[],
    ...(settings.fetchProvider ? { crawlerImpls: [settings.fetchProvider] } : {}),
    providers,
    crawlerConfigs,
    maxResults: settings.maxResults ?? DEFAULT_WEB_SEARCH_SETTINGS.maxResults,
  })
}
