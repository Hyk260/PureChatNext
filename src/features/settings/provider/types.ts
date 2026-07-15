export type ProviderId = 'openai' | 'deepseek'

export interface ProviderConfig {
  apiKey: string
  baseURL: string
  enabled: boolean
}

export type ProviderConfigs = Record<ProviderId, ProviderConfig>
