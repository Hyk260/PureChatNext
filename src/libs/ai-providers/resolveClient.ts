import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import type { ModelAbilities } from '@pure/model-bank'
import { llmEnv } from '@/envs/llm'

import { createTimedFetch } from './timedFetch'

export type SupportedProviderId = 'openai' | 'deepseek' | 'bailian' | 'openrouter'

export type ProviderLanguageModelOptions = {
  timeoutMs?: number
}

export const PROVIDER_RUNTIME_DEFAULT_BASE_URLS: Record<SupportedProviderId, string> = {
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

export const isSupportedProviderId = (id: string): id is SupportedProviderId =>
  id === 'openai' || id === 'deepseek' || id === 'bailian' || id === 'openrouter'

export const resolveApiKeyFromHeader = (request: Request) => {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return undefined

  const token = authHeader.slice('Bearer '.length).trim()
  return token || undefined
}

export const resolveProviderApiKey = (
  provider: SupportedProviderId,
  headerKey: string | undefined,
  bodyKey: string | undefined
) => {
  const fromRequest = headerKey?.trim() || bodyKey?.trim()
  if (fromRequest) return fromRequest

  let envKey: string | undefined
  if (provider === 'openai') envKey = process.env.OPENAI_API_KEY
  if (provider === 'deepseek') envKey = process.env.DEEPSEEK_API_KEY
  if (provider === 'bailian') envKey = llmEnv.DASHSCOPE_API_KEY
  return envKey?.trim() || undefined
}

/** Empty / whitespace baseURL → undefined (SDK default). Otherwise trimmed custom URL. */
export const resolveOptionalBaseURL = (baseURL: string | undefined) => {
  if (typeof baseURL !== 'string') return undefined
  const trimmed = baseURL.trim()
  return trimmed || undefined
}

export const resolveModelsListBaseURL = (provider: SupportedProviderId, baseURL: string | undefined) =>
  resolveOptionalBaseURL(baseURL) ?? PROVIDER_RUNTIME_DEFAULT_BASE_URLS[provider]

export const createProviderLanguageModel = (
  provider: SupportedProviderId,
  model: string,
  apiKey: string | undefined,
  baseURL: string | undefined,
  options?: ProviderLanguageModelOptions
): LanguageModel => {
  if (provider === 'openrouter') {
    return createOpenRouterLanguageModel(
      model,
      apiKey ?? '',
      baseURL ?? PROVIDER_RUNTIME_DEFAULT_BASE_URLS.openrouter,
      options
    )
  }
  if (provider === 'bailian') {
    return createOpenAICompatibleLanguageModel(
      model,
      apiKey ?? '',
      baseURL ?? PROVIDER_RUNTIME_DEFAULT_BASE_URLS.bailian,
      options
    )
  }

  const clientOptions: {
    apiKey?: string
    baseURL?: string
    fetch?: ReturnType<typeof createTimedFetch>
  } = {}
  if (apiKey) clientOptions.apiKey = apiKey
  if (baseURL) clientOptions.baseURL = baseURL
  clientOptions.fetch = createTimedFetch(options?.timeoutMs)

  const providerOptions = Object.keys(clientOptions).length > 0 ? clientOptions : undefined

  switch (provider) {
    case 'openai':
      return createOpenAI(providerOptions)(model)
    case 'deepseek':
      return createDeepSeek(providerOptions)(model)
  }
}

/** OpenAI-compatible providers use Chat Completions for maximum endpoint compatibility. */
export const createOpenAICompatibleLanguageModel = (
  model: string,
  apiKey: string,
  baseURL: string,
  options?: ProviderLanguageModelOptions
): LanguageModel =>
  createOpenAI({
    apiKey,
    baseURL,
    fetch: createTimedFetch(options?.timeoutMs),
  }).chat(model)

export interface RemoteModelListItem {
  abilities?: ModelAbilities
  contextWindowTokens?: number
  displayName?: string
  family?: string
  group?: string
  inputModalities?: string[]
  id: string
  outputModalities?: string[]
  pricing?: { inputPerMillion?: number; outputPerMillion?: number }
}

/**
 * Fetch OpenAI-compatible GET {baseURL}/models.
 */
export const fetchOpenAICompatibleModels = async (params: {
  apiKey: string
  baseURL: string
}): Promise<RemoteModelListItem[]> => {
  const base = params.baseURL.replace(/\/+$/, '')
  const response = await createTimedFetch(30_000)(`${base}/models`, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'GET',
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Failed to list models (${response.status})${text ? `: ${text.slice(0, 400)}` : ''}`)
  }

  const json = (await response.json()) as {
    data?: Array<{ id?: string; name?: string }>
  }

  const data = Array.isArray(json.data) ? json.data : []
  const models: RemoteModelListItem[] = []

  for (const item of data) {
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!id) continue
    models.push({
      displayName: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id,
      id,
    })
  }

  return models
}

export const createOpenRouterLanguageModel = (
  model: string,
  apiKey: string,
  baseURL = 'https://openrouter.ai/api/v1',
  options?: ProviderLanguageModelOptions
): LanguageModel => {
  const provider = createOpenRouter({
    apiKey,
    appName: 'PureChat',
    appUrl: 'https://app.purechat.cn',
    baseURL,
    compatibility: 'strict',
    fetch: createTimedFetch(options?.timeoutMs),
  })
  return provider.chat(model) as unknown as LanguageModel
}

const asStringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const parsePerMillionPrice = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric * 1_000_000 : undefined
}

/** Fetch OpenRouter's authenticated model catalog and preserve provider metadata. */
export const fetchOpenRouterModels = async (params: {
  apiKey: string
  baseURL?: string
}): Promise<RemoteModelListItem[]> => {
  const base = (params.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const response = await createTimedFetch(30_000)(`${base}/models`, {
    headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
    method: 'GET',
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Failed to list OpenRouter models (${response.status})${text ? `: ${text.slice(0, 400)}` : ''}`)
  }

  const json = (await response.json()) as {
    data?: Array<{
      architecture?: { input_modalities?: unknown; output_modalities?: unknown }
      context_length?: unknown
      id?: unknown
      name?: unknown
      pricing?: { completion?: unknown; prompt?: unknown }
      supported_parameters?: unknown
    }>
  }

  return (Array.isArray(json.data) ? json.data : []).flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!id) return []
    const inputModalities = asStringList(item.architecture?.input_modalities)
    const outputModalities = asStringList(item.architecture?.output_modalities)
    const supported = new Set(asStringList(item.supported_parameters))
    const abilities: ModelAbilities = {
      audioInput: inputModalities.includes('audio'),
      audioOutput: outputModalities.includes('audio'),
      functionCall: supported.has('tools') || supported.has('tool_choice'),
      imageGeneration: outputModalities.includes('image'),
      reasoning: supported.has('reasoning') || supported.has('include_reasoning'),
      structuredOutput: supported.has('structured_outputs') || supported.has('response_format'),
      vision: inputModalities.includes('image'),
    }
    const contextWindowTokens = Number(item.context_length)
    const promptPrice = parsePerMillionPrice(item.pricing?.prompt)
    const completionPrice = parsePerMillionPrice(item.pricing?.completion)

    return [{
      abilities,
      ...(Number.isFinite(contextWindowTokens) && contextWindowTokens > 0 ? { contextWindowTokens } : {}),
      displayName: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id,
      group: id.includes('/') ? id.split('/')[0] : undefined,
      id,
      inputModalities,
      outputModalities,
      pricing: {
        ...(promptPrice === undefined ? {} : { inputPerMillion: promptPrice }),
        ...(completionPrice === undefined ? {} : { outputPerMillion: completionPrice }),
      },
    }]
  })
}

type BailianModelCatalogEntry = {
  capabilities?: unknown
  features?: unknown
  inference_metadata?: {
    request_modality?: unknown
    response_modality?: unknown
  }
  model?: unknown
  model_info?: {
    context_window?: unknown
  }
  name?: unknown
  provider?: unknown
}

type BailianModelCatalogPage = {
  output?: {
    models?: BailianModelCatalogEntry[]
    total?: number
  }
}

const BAILIAN_MODEL_PAGE_SIZE = 100
const BAILIAN_MODEL_PAGE_LIMIT = 10

const getPositiveNumber = (value: unknown) => {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(number) && number > 0 ? number : undefined
}

const toLowercaseList = (value: unknown) => asStringList(value).map((item) => item.toLowerCase())

const getBailianModelsURL = (baseURL: string, page: number) => {
  const url = new URL(baseURL)
  const compatibleModePath = /\/compatible-mode\/v1\/?$/
  if (!compatibleModePath.test(url.pathname)) {
    throw new Error('百炼模型目录查询要求 Base URL 使用 /compatible-mode/v1')
  }

  url.pathname = url.pathname.replace(compatibleModePath, '/api/v1/models')
  url.search = ''
  url.searchParams.set('capabilities', 'TG')
  url.searchParams.append('capabilities', 'TTS')
  url.searchParams.set('page_no', String(page))
  url.searchParams.set('page_size', String(BAILIAN_MODEL_PAGE_SIZE))
  return url
}

const mapBailianModel = (item: BailianModelCatalogEntry): RemoteModelListItem | undefined => {
  const id = typeof item.model === 'string' ? item.model.trim() : ''
  if (!id) return undefined

  const capabilities = new Set(asStringList(item.capabilities))
  const features = new Set(asStringList(item.features))
  const inputModalities = toLowercaseList(item.inference_metadata?.request_modality)
  const outputModalities = toLowercaseList(item.inference_metadata?.response_modality)

  return {
    abilities: {
      audioInput: inputModalities.includes('audio'),
      audioOutput: outputModalities.includes('audio') || capabilities.has('TTS'),
      functionCall: features.has('function-calling'),
      imageGeneration: capabilities.has('IG') || outputModalities.includes('image'),
      reasoning: capabilities.has('Reasoning'),
      structuredOutput: features.has('structured-outputs'),
      textToSpeech: capabilities.has('TTS'),
      vision: capabilities.has('VU') || inputModalities.includes('image'),
      webSearch: features.has('web-search'),
    },
    contextWindowTokens: getPositiveNumber(item.model_info?.context_window),
    displayName: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id,
    family: typeof item.provider === 'string' ? item.provider : undefined,
    id,
    inputModalities,
    outputModalities,
  }
}

/** Fetch Bailian's native text-generation and TTS catalog using the same regional host as its OpenAI-compatible endpoint. */
export const fetchBailianModels = async (params: {
  apiKey: string
  baseURL: string
}): Promise<RemoteModelListItem[]> => {
  const fetchPage = async (page: number) => {
    const url = getBailianModelsURL(params.baseURL, page)
    const response = await createTimedFetch(30_000)(url, {
      headers: {
        Authorization: 'Bearer ' + params.apiKey,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        '获取百炼模型列表失败 (' +
          response.status +
          ')' +
          (text ? ': ' + text.slice(0, 400) : '')
      )
    }

    return (await response.json()) as BailianModelCatalogPage
  }

  const firstPage = await fetchPage(1)
  const total = getPositiveNumber(firstPage.output?.total) ?? firstPage.output?.models?.length ?? 0
  const totalPages = Math.min(Math.ceil(total / BAILIAN_MODEL_PAGE_SIZE), BAILIAN_MODEL_PAGE_LIMIT)
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => fetchPage(index + 2))
  )
  const pages = [firstPage, ...remainingPages]

  return pages.flatMap((page) =>
    (Array.isArray(page.output?.models) ? page.output.models : [])
      .map(mapBailianModel)
      .filter((model): model is RemoteModelListItem => Boolean(model))
  )
}
