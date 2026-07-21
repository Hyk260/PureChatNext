import { COMMUNITY_PROVIDERS } from '@/const/community/providers'
import { HOME_MODELS } from '@/const/home/models'

import {
  type ProviderConfig,
  type ProviderConfigs,
  type ProviderId,
  type ProviderModelItem,
} from './types'

export const SETTINGS_PROVIDER_IDS = ['openai', 'deepseek'] as const satisfies readonly ProviderId[]

export const isSettingsProviderId = (id: string): id is ProviderId =>
  (SETTINGS_PROVIDER_IDS as readonly string[]).includes(id)

/** UI placeholder only — empty config.baseURL falls back to SDK defaults at request time. */
export const PROVIDER_DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
}

/** Legacy defaults persisted in purechat:provider:v1 before empty-baseURL migration. */
export const LEGACY_PROVIDER_DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
}

export const PROVIDER_CHECK_MODELS: Record<ProviderId, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4o-mini',
}

export const getBuiltinProviderModels = (id: ProviderId): ProviderModelItem[] =>
  HOME_MODELS.filter((item) => item.provider === id).map((item) => ({
    displayName: item.displayName,
    enabled: true,
    id: item.model,
    source: 'builtin' as const,
  }))

export const createDefaultProviderConfig = (id: ProviderId): ProviderConfig => ({
  apiKey: '',
  baseURL: '',
  checkModel: PROVIDER_CHECK_MODELS[id],
  enabled: false,
  models: getBuiltinProviderModels(id),
})

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfigs = {
  deepseek: createDefaultProviderConfig('deepseek'),
  openai: createDefaultProviderConfig('openai'),
}

export const SETTINGS_PROVIDERS = COMMUNITY_PROVIDERS.filter((provider) =>
  isSettingsProviderId(provider.identifier),
)

export const getSettingsProviderMeta = (id: ProviderId) => {
  const meta = SETTINGS_PROVIDERS.find((provider) => provider.identifier === id)
  if (!meta) {
    throw new Error(`Unknown settings provider: ${id}`)
  }
  return meta
}
