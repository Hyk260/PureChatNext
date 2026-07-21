import { COMMUNITY_PROVIDERS } from '@/const/community/providers'

import { type ProviderConfigs, type ProviderId } from './types'

export const SETTINGS_PROVIDER_IDS = ['openai', 'deepseek'] as const satisfies readonly ProviderId[]

export const isSettingsProviderId = (id: string): id is ProviderId =>
  (SETTINGS_PROVIDER_IDS as readonly string[]).includes(id)

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfigs = {
  deepseek: {
    apiKey: '',
    baseURL: 'https://api.deepseek.com',
    enabled: false,
  },
  openai: {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    enabled: false,
  },
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
