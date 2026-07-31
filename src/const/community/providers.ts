import { deepseekChatModels, DEFAULT_MODEL_PROVIDER_LIST, openaiChatModels, purehubChatModels } from '@pure/model-bank'

import type { DiscoverProviderItem } from '@/features/community/types'

const modelsByProvider = {
  deepseek: deepseekChatModels,
  openai: openaiChatModels,
  purehub: purehubChatModels,
} as const

const getVisibleModels = (models: (typeof modelsByProvider)[keyof typeof modelsByProvider]) =>
  models.filter((model) => model.enabled !== false)

/** 社区 / 设置侧服务商列表，模型 id 来自 `@pure/model-bank`。 */
export const COMMUNITY_PROVIDERS: DiscoverProviderItem[] = DEFAULT_MODEL_PROVIDER_LIST.map((provider) => {
  const providerModels = modelsByProvider[provider.id as keyof typeof modelsByProvider]
  const models = providerModels ? getVisibleModels(providerModels).map((model) => model.id) : []
  return {
    description: provider.description,
    id: provider.id,
    identifier: provider.id,
    modelCount: models.length,
    models,
    name: provider.name,
    url: provider.url ?? '',
  }
})
