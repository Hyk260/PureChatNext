export enum DiscoverTab {
  Agent = 'agent',
  Model = 'model',
  Provider = 'provider',
}

export interface DiscoverProviderItem {
  description: string
  id: string
  identifier: string
  modelCount: number
  models: string[]
  name: string
  url: string
}
