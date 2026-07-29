export type ProviderId = 'openai' | 'deepseek' | 'purehub'

export type ProviderModelSource = 'builtin' | 'remote'

export interface ProviderModelItem {
  displayName: string
  enabled: boolean
  id: string
  source: ProviderModelSource
}

export interface ProviderConfig {
  apiKey: string
  /** Empty means use the provider SDK default endpoint. */
  baseURL: string
  checkModel: string
  enabled: boolean
  models: ProviderModelItem[]
}

export type ProviderConfigs = Record<ProviderId, ProviderConfig>
