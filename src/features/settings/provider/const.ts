import {
  DEFAULT_MODEL_PROVIDER_LIST,
  ModelProvider,
  PUREHUB_DEFAULT_MODEL,
  getProviderChatModels,
  purehubProviderCard,
} from '@pure/model-bank'

import type { ProviderConfig, ProviderConfigs, ProviderId, ProviderModelItem } from './types'

export const SETTINGS_PROVIDER_IDS = [
  ModelProvider.PureHub,
  ModelProvider.OpenAI,
  ModelProvider.DeepSeek,
] as const satisfies readonly ProviderId[]

export const isSettingsProviderId = (id: string): id is ProviderId =>
  (SETTINGS_PROVIDER_IDS as readonly string[]).includes(id)

/** UI placeholder only — empty config.baseURL falls back to SDK defaults at request time. */
export const PROVIDER_DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  purehub: 'https://ai-gateway.vercel.sh/v1',
}

/** Legacy defaults persisted in purechat:provider:v1 before empty-baseURL migration. */
export const LEGACY_PROVIDER_DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  purehub: 'https://ai-gateway.vercel.sh/v1',
}

export const PROVIDER_CHECK_MODELS: Record<ProviderId, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-5.4-mini',
  purehub: PUREHUB_DEFAULT_MODEL,
}

/** showConfig=false 的服务商（如 PureHub）由服务端持有 Key。 */
export const isServerManagedProvider = (id: ProviderId) => {
  const card = DEFAULT_MODEL_PROVIDER_LIST.find((p) => p.id === id)
  return card ? !card.showConfig : false
}

export const getBuiltinProviderModels = (id: ProviderId): ProviderModelItem[] =>
  getProviderChatModels(id).map((item) => ({
    displayName: item.displayName,
    enabled: item.enabled !== false,
    id: item.id,
    source: 'builtin' as const,
  }))

export const createDefaultProviderConfig = (id: ProviderId): ProviderConfig => ({
  apiKey: '',
  baseURL: '',
  checkModel: PROVIDER_CHECK_MODELS[id],
  enabled: id === ModelProvider.PureHub ? purehubProviderCard.enabled : false,
  models: getBuiltinProviderModels(id),
})

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfigs = {
  deepseek: createDefaultProviderConfig('deepseek'),
  openai: createDefaultProviderConfig('openai'),
  purehub: createDefaultProviderConfig('purehub'),
}

export const SETTINGS_PROVIDERS = DEFAULT_MODEL_PROVIDER_LIST.filter((provider) =>
  isSettingsProviderId(provider.id)
).map((provider) => ({
  description: provider.description,
  id: provider.id,
  identifier: provider.id,
  modelCount: getProviderChatModels(provider.id as ProviderId).filter((model) => model.enabled !== false).length,
  models: getProviderChatModels(provider.id as ProviderId)
    .filter((model) => model.enabled !== false)
    .map((model) => model.id),
  name: provider.name,
  url: provider.url ?? '',
}))

export const getSettingsProviderMeta = (id: ProviderId) => {
  const meta = SETTINGS_PROVIDERS.find((provider) => provider.identifier === id)
  if (!meta) {
    throw new Error(`Unknown settings provider: ${id}`)
  }
  return meta
}
