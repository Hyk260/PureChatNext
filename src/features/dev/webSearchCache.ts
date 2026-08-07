export type ActionMode = 'query' | 'webSearch' | 'crawlPages'

export const WEB_SEARCH_CACHE_KEY = 'purechat:dev:web-search:v1'

export type WebSearchCachedForm = {
  categories?: string
  engines?: string
  impls?: string
  provider?: string
  query?: string
  timeRange?: string
  urls?: string
}

export type WebSearchCachedSlot<TPayload = unknown, TRunState = unknown> = {
  form: WebSearchCachedForm
  payload: TPayload
  runState: TRunState
}

export type WebSearchCacheStore<TPayload = unknown, TRunState = unknown> = Partial<
  Record<ActionMode, WebSearchCachedSlot<TPayload, TRunState>>
>

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isActionMode = (value: unknown): value is ActionMode => {
  return value === 'query' || value === 'webSearch' || value === 'crawlPages'
}

const parseForm = (value: unknown): WebSearchCachedForm => {
  if (!isRecord(value)) {
    return {}
  }

  const pick = (key: keyof WebSearchCachedForm) => {
    const next = value[key]
    return typeof next === 'string' ? next : undefined
  }

  return {
    categories: pick('categories'),
    engines: pick('engines'),
    impls: pick('impls'),
    provider: pick('provider'),
    query: pick('query'),
    timeRange: pick('timeRange'),
    urls: pick('urls'),
  }
}

const parseSlot = <TPayload, TRunState>(value: unknown): WebSearchCachedSlot<TPayload, TRunState> | null => {
  if (!isRecord(value) || !('payload' in value) || !('runState' in value)) {
    return null
  }

  return {
    form: parseForm(value.form),
    payload: value.payload as TPayload,
    runState: value.runState as TRunState,
  }
}

export const readWebSearchCache = <TPayload = unknown, TRunState = unknown>(): WebSearchCacheStore<
  TPayload,
  TRunState
> => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(WEB_SEARCH_CACHE_KEY)
    if (!raw) {
      return {}
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return {}
    }

    const store: WebSearchCacheStore<TPayload, TRunState> = {}

    for (const key of Object.keys(parsed)) {
      if (!isActionMode(key)) {
        continue
      }

      const slot = parseSlot<TPayload, TRunState>(parsed[key])
      if (slot) {
        store[key] = slot
      }
    }

    return store
  } catch {
    return {}
  }
}

export const writeWebSearchCacheSlot = <TPayload, TRunState>(
  action: ActionMode,
  slot: WebSearchCachedSlot<TPayload, TRunState>
): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const store = readWebSearchCache<TPayload, TRunState>()
    store[action] = slot
    localStorage.setItem(WEB_SEARCH_CACHE_KEY, JSON.stringify(store))
  } catch {
    // Ignore quota / private mode errors
  }
}

export const clearWebSearchCache = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(WEB_SEARCH_CACHE_KEY)
  } catch {
    // Ignore quota / private mode errors
  }
}
