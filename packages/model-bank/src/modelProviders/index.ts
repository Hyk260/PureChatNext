import { deepseekProviderCard } from './deepseek'
import { openaiProviderCard } from './openai'
import { purehubProviderCard } from './purehub'
import type { ModelProviderCard } from '../types/aiModel'

/** 默认启用的内置服务商列表（PureHub 优先）。 */
export const DEFAULT_MODEL_PROVIDER_LIST: ModelProviderCard[] = [
  purehubProviderCard,
  openaiProviderCard,
  deepseekProviderCard,
]

export { deepseekProviderCard, openaiProviderCard, purehubProviderCard }
