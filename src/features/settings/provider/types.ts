import type { ModelAbilities } from '@pure/model-bank'

export type ProviderId = 'openai' | 'deepseek' | 'purechat'

export type ProviderModelSource = 'builtin' | 'custom' | 'remote'

export type ProviderModelHealthStatus = 'idle' | 'checking' | 'success' | 'failure'

export interface ProviderModelHealth {
  checkedAt?: string
  durationMs?: number
  message?: string
  status: ProviderModelHealthStatus
}

export interface ProviderModelItem {
  abilities?: ModelAbilities
  contextWindowTokens?: number
  displayName: string
  enabled: boolean
  health?: ProviderModelHealth
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
