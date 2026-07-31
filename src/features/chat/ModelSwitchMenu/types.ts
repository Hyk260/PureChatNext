import type { HomeModelItem } from '@/const/home/models'

export type GroupMode = 'byModel' | 'byProvider'

export interface EnabledProviderGroup {
  id: string
  name: string
  models: HomeModelItem[]
}

export interface ModelWithProviders {
  displayName: string
  model: string
  providers: Array<{ id: string; name: string }>
}

export type ListItem =
  | { type: 'model-item-single'; data: ModelWithProviders }
  | { type: 'model-item-multiple'; data: ModelWithProviders }
  | { type: 'group-header'; provider: EnabledProviderGroup }
  | { type: 'provider-model-item'; provider: EnabledProviderGroup; model: HomeModelItem }
  | { type: 'empty-model'; provider: EnabledProviderGroup }
  | { type: 'no-provider' }

export const menuKey = (provider: string, model: string) => `${provider}:${model}`
