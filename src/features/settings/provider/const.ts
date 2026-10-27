import { BUILTIN_PROVIDER_ID_LIST } from '@pure/const'
import {
  DEFAULT_MODEL_PROVIDER_LIST,
  ModelProvider,
  getProviderChatModels,
  purechatProviderCard,
  PROVIDER_DEFAULT_MODELS,
} from '@pure/model-bank'

import type { CustomProviderDefinition, ProviderConfig, ProviderConfigs, ProviderId, ProviderModelItem } from './types'

export const SETTINGS_PROVIDER_IDS = BUILTIN_PROVIDER_ID_LIST

export type SettingsProviderId = (typeof SETTINGS_PROVIDER_IDS)[number]

export const isSettingsProviderId = (id: string): id is SettingsProviderId =>
  (SETTINGS_PROVIDER_IDS as readonly string[]).includes(id)

export const isCustomProviderId = (id: string, providers: readonly CustomProviderDefinition[]) =>
  providers.some((provider) => provider.id === id)

/** UI placeholder only — empty config.baseURL falls back to SDK defaults at request time. */
export const PROVIDER_DEFAULT_BASE_URLS: Record<(typeof SETTINGS_PROVIDER_IDS)[number], string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  purechat: 'https://ai-gateway.vercel.sh/v1',
}

/** Legacy defaults persisted in purechat:provider:v1 before empty-baseURL migration. */
export const LEGACY_PROVIDER_DEFAULT_BASE_URLS: Record<(typeof SETTINGS_PROVIDER_IDS)[number], string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  purechat: 'https://ai-gateway.vercel.sh/v1',
}

export const PROVIDER_CHECK_MODELS = PROVIDER_DEFAULT_MODELS

/** Server-side env var that backs each provider when the browser key is empty. */
export const PROVIDER_ENV_API_KEY_NAME: Partial<Record<ProviderId, string>> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  purechat: 'PURECHAT_API_KEY',
}

/** showConfig=false 的服务商（如 PureChat）由服务端持有 Key。 */
export const isServerManagedProvider = (id: ProviderId) => {
  return id === ModelProvider.PureChat
}

export const getBuiltinProviderModels = (id: ProviderId): ProviderModelItem[] =>
  isSettingsProviderId(id)
    ? getProviderChatModels(id).map((item) => ({
        displayName: item.displayName,
        enabled: item.enabled !== false,
        id: item.id,
        source: 'builtin' as const,
      }))
    : []

export const createDefaultProviderConfig = (id: ProviderId): ProviderConfig => ({
  apiKey: '',
  baseURL: '',
  checkModel: isSettingsProviderId(id) ? PROVIDER_CHECK_MODELS[id] : '',
  enabled: id === ModelProvider.PureChat ? purechatProviderCard.enabled : false,
  models: getBuiltinProviderModels(id),
})

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfigs = {
  deepseek: createDefaultProviderConfig('deepseek'),
  openai: createDefaultProviderConfig('openai'),
  purechat: createDefaultProviderConfig('purechat'),
}

export const SETTINGS_PROVIDERS = DEFAULT_MODEL_PROVIDER_LIST.filter((provider) =>
  isSettingsProviderId(provider.id)
).map((provider) => {
  const id = provider.id as SettingsProviderId
  const models = getProviderChatModels(id).filter((model) => model.enabled !== false)

  return {
    description: provider.description,
    id,
    identifier: id,
    logo: undefined,
    modelCount: models.length,
    models: models.map((model) => model.id),
    name: provider.name,
    url: provider.url ?? '',
  }
})

export const getSettingsProviderMeta = (id: ProviderId, customProviders: readonly CustomProviderDefinition[] = []) => {
  const meta = SETTINGS_PROVIDERS.find((provider) => provider.identifier === id)
  if (meta) return meta

  const custom = customProviders.find((provider) => provider.id === id)
  if (custom) {
    return {
      description: custom.description,
      id: custom.id,
      identifier: custom.id,
      logo: custom.logo,
      modelCount: 0,
      models: [],
      name: custom.name,
      url: custom.baseURL,
    }
  }

  throw new Error(`Unknown settings provider: ${id}`)
}
