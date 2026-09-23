'use client'

import { useEffect, useState } from 'react'
import { Segmented } from 'antd'
import { Compass, Globe2, Search } from 'lucide-react'

import { apiFetch, jsonInit } from '@/utils/apiFetch'

import type { ActionMode, WebSearchCachedForm, WebSearchCachedSlot } from '../webSearchCache'
import { clearWebSearchCache, readWebSearchCache, writeWebSearchCacheSlot } from '../webSearchCache'
import { WebSearchForm } from './WebSearchForm'
import { WebSearchResults } from './WebSearchResults'
import {
  ACTION_META,
  buildRequestBody,
  canSubmit,
  EXAMPLE_QUERY,
  EXAMPLE_URLS,
  resolveProviderValue,
  toggleImplList,
  WEB_SEARCH_API_PATH,
} from './webSearchModel'
import type { ApiFailure, ApiSuccess, CopyState, ResultView, RunState, SearXNGConfig, WebSearchConfigResponse, WebSearchFormValues } from './webSearchModel'

const ACTION_ICONS = {
  crawlPages: Compass,
  query: Search,
  webSearch: Globe2,
} as const

const ACTION_ORDER: ActionMode[] = ['query', 'webSearch', 'crawlPages']

const segmentedIconLabel = (Icon: (typeof ACTION_ICONS)[ActionMode], text: string, title: string) => (
  <span className='inline-flex items-center gap-1.5' title={title}>
    <Icon className='size-4 shrink-0' />
    {text}
  </span>
)

const ACTION_SEGMENTED_OPTIONS = ACTION_ORDER.map((value) => ({
  label: segmentedIconLabel(ACTION_ICONS[value], ACTION_META[value].label, ACTION_META[value].description),
  value,
}))

type CachedSlot = WebSearchCachedSlot<ApiSuccess, RunState>

const initialValues = (): WebSearchFormValues => ({
  categories: 'general',
  engines: '',
  impls: '',
  provider: '',
  query: EXAMPLE_QUERY,
  timeRange: '',
  urls: EXAMPLE_URLS,
})

export default function WebSearchPage() {
  const [action, setAction] = useState<ActionMode>('webSearch')
  const [view, setView] = useState<ResultView>('summary')
  const [values, setValues] = useState<WebSearchFormValues>(initialValues)
  const [isLoading, setIsLoading] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [payload, setPayload] = useState<ApiSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [searxngConfig, setSearxngConfig] = useState<SearXNGConfig | null>(null)
  const [configuredProviders, setConfiguredProviders] = useState<string[] | null>(null)

  const configuredProviderSet = configuredProviders ? new Set(configuredProviders) : new Set<string>()
  const requestBody = buildRequestBody(action, values)
  const requestJson = JSON.stringify(requestBody, null, 2)
  const rawJson = payload ? JSON.stringify(payload, null, 2) : ''

  const applyForm = (form: WebSearchCachedForm, configured: ReadonlySet<string> | null) => {
    setValues((current) => ({
      categories: form.categories ?? current.categories,
      engines: form.engines ?? current.engines,
      impls: form.impls ?? current.impls,
      provider:
        typeof form.provider === 'string' ? resolveProviderValue(form.provider, configured) : current.provider,
      query: form.query ?? current.query,
      timeRange: form.timeRange ?? current.timeRange,
      urls: form.urls ?? current.urls,
    }))
  }

  const applySlot = (slot: CachedSlot, configured: ReadonlySet<string> | null) => {
    setPayload(slot.payload)
    setRunState(slot.runState)
    applyForm(slot.form, configured)
    setError(null)
    setCopyState('idle')
    setView('summary')
  }

  const snapshotForm = (): WebSearchCachedForm => {
    if (action === 'crawlPages') return { impls: values.impls, urls: values.urls }
    return {
      categories: values.categories,
      engines: values.engines,
      provider: values.provider,
      query: values.query,
      timeRange: values.timeRange,
    }
  }

  useEffect(() => {
    void apiFetch(WEB_SEARCH_API_PATH)
      .then(async (response) => (response.ok ? ((await response.json()) as WebSearchConfigResponse) : null))
      .then((config) => {
        const nextConfigured = Array.isArray(config?.configuredProviders)
          ? config.configuredProviders.filter((item): item is string => typeof item === 'string')
          : []
        const configured = new Set(nextConfigured)

        if (config?.searxng) setSearxngConfig(config.searxng)
        setConfiguredProviders(nextConfigured)
        setValues((current) => ({ ...current, provider: resolveProviderValue(current.provider, configured) }))
      })
      .catch(() => {
        setConfiguredProviders([])
        setValues((current) => ({ ...current, provider: resolveProviderValue(current.provider, new Set()) }))
      })

    const slot = readWebSearchCache<ApiSuccess, RunState>().webSearch
    if (slot) {
      // Hydrating a cached form is an intentional one-time state restoration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applySlot(slot, null)
    }
    // Hydrate once on mount for the default action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateValues = (patch: Partial<WebSearchFormValues>) => {
    if (patch.query !== undefined || patch.urls !== undefined) setError(null)
    setValues((current) => ({ ...current, ...patch }))
  }

  const selectAction = (nextAction: ActionMode) => {
    if (nextAction === action) return

    setAction(nextAction)
    setCopyState('idle')
    setError(null)

    const slot = readWebSearchCache<ApiSuccess, RunState>()[nextAction]
    if (slot) {
      applySlot(slot, configuredProviders ? configuredProviderSet : null)
      return
    }

    setPayload(null)
    setRunState(null)
    if (nextAction === 'crawlPages') {
      setValues((current) => ({ ...current, urls: EXAMPLE_URLS }))
      return
    }

    setValues((current) => ({ ...current, query: EXAMPLE_QUERY }))
  }

  const submit = async () => {
    if (!canSubmit(action, values)) return

    setIsLoading(true)
    setError(null)
    setPayload(null)
    setCopyState('idle')

    const startedAt = performance.now()
    const submittedAt = new Date().toLocaleString()

    try {
      const response = await apiFetch(WEB_SEARCH_API_PATH, jsonInit(requestBody, { method: 'POST' }))
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
      writeWebSearchCacheSlot(action, { form: snapshotForm(), payload: data, runState: nextRunState })
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
    setValues(initialValues())
    setPayload(null)
    setError(null)
    setRunState(null)
    setCopyState('idle')
  }

  const clearCache = () => {
    clearWebSearchCache()
    setValues((current) => ({
      ...current,
      categories: 'general',
      engines: '',
      impls: '',
      provider: '',
      timeRange: '',
    }))
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

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8'>
        <header className='flex shrink-0 flex-col justify-between gap-3 border-b border-border pb-4 lg:flex-row lg:items-end'>
          <div>
            <h1 className='text-2xl font-semibold text-foreground'>联网搜索功能测试台</h1>
            <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
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

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]'>
          <WebSearchForm
            action={action}
            configuredProviders={configuredProviderSet}
            copyState={copyState}
            engines={searxngConfig?.engines ?? null}
            isLoading={isLoading}
            requestJson={requestJson}
            runState={runState}
            values={values}
            onChange={updateValues}
            onClearCache={clearCache}
            onCopy={() => void copyRequestJson()}
            onReset={reset}
            onSubmit={() => void submit()}
            onToggleImpl={(value) => updateValues({ impls: toggleImplList(values.impls, value) })}
          />
          <WebSearchResults
            action={action}
            error={error}
            payload={payload}
            provider={values.provider}
            rawJson={rawJson}
            runState={runState}
            view={view}
            onViewChange={setView}
          />
        </div>
      </div>
    </main>
  )
}
