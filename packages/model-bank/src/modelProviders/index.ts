import { bailianProviderCard } from './bailian'
import { deepseekProviderCard } from './deepseek'
import { lmStudioProviderCard } from './lmstudio'
import { openaiProviderCard } from './openai'
import { openRouterProviderCard } from './openrouter'
import { purechatProviderCard } from './purechat'
import type { ModelProviderCard } from '../types/aiModel'

/** 默认启用的内置服务商列表（PureChat 优先）。 */
export const DEFAULT_MODEL_PROVIDER_LIST: ModelProviderCard[] = [
  purechatProviderCard,
  openaiProviderCard,
  deepseekProviderCard,
  bailianProviderCard,
  openRouterProviderCard,
  lmStudioProviderCard,
]

export {
  bailianProviderCard,
  deepseekProviderCard,
  lmStudioProviderCard,
  openaiProviderCard,
  openRouterProviderCard,
  purechatProviderCard,
}
