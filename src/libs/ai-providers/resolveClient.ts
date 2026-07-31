import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export type SupportedProviderId = 'openai' | 'deepseek'

export const PROVIDER_RUNTIME_DEFAULT_BASE_URLS: Record<SupportedProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
}

export const isSupportedProviderId = (id: string): id is SupportedProviderId => id === 'openai' || id === 'deepseek'

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

  const envKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY
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
  baseURL: string | undefined
): LanguageModel => {
  const options: { apiKey?: string; baseURL?: string } = {}
  if (apiKey) options.apiKey = apiKey
  if (baseURL) options.baseURL = baseURL

  const providerOptions = Object.keys(options).length > 0 ? options : undefined

  switch (provider) {
    case 'openai':
      return createOpenAI(providerOptions)(model)
    case 'deepseek':
    default:
      return createDeepSeek(providerOptions)(model)
  }
}

export interface RemoteModelListItem {
  displayName?: string
  id: string
}

/**
 * Fetch OpenAI-compatible GET {baseURL}/models.
 */
export const fetchOpenAICompatibleModels = async (params: {
  apiKey: string
  baseURL: string
}): Promise<RemoteModelListItem[]> => {
  const base = params.baseURL.replace(/\/+$/, '')
  const response = await fetch(`${base}/models`, {
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
