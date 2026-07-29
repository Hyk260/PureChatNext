import {
  AI_MODELS_BY_PROVIDER,
  DEFAULT_MODEL_PROVIDER_LIST,
  type ModelProviderId,
} from '@pure/model-bank'

import { type DiscoverModelItem } from '@/features/community/types'

/** 社区模型列表，字段来自 `@pure/model-bank`。 */
export const COMMUNITY_MODELS: DiscoverModelItem[] = (
  Object.entries(AI_MODELS_BY_PROVIDER) as Array<
    [ModelProviderId, (typeof AI_MODELS_BY_PROVIDER)[ModelProviderId]]
  >
).flatMap(([provider, models]) =>
  models
    .filter((model) => model.enabled !== false)
    .map((model) => ({
      abilities: model.abilities
        ? {
            functionCall: model.abilities.functionCall,
            vision: model.abilities.vision,
          }
        : undefined,
      contextWindowTokens: model.contextWindowTokens,
      description: model.description ?? '',
      displayName: model.displayName,
      /** 跨服务商可能同 id（如 purehub / deepseek 均有 deepseek-v4-*），需拼 provider 保证唯一 */
      id: `${provider}/${model.id}`,
      identifier: model.id,
      providers: [provider],
      releasedAt: model.releasedAt,
      type: 'chat' as const,
    }))
)

export const getModelProviderCounts = (
  models: DiscoverModelItem[] = COMMUNITY_MODELS
): Record<string, number> => {
  const counts: Record<string, number> = { all: models.length }

  for (const provider of DEFAULT_MODEL_PROVIDER_LIST) {
    counts[provider.id] = 0
  }

  for (const model of models) {
    for (const providerId of model.providers) {
      counts[providerId] = (counts[providerId] ?? 0) + 1
    }
  }

  return counts
}

export const filterCommunityModels = (
  models: DiscoverModelItem[],
  options: { category?: string | null; q?: string | null }
): DiscoverModelItem[] => {
  const category = options.category?.trim() || 'all'
  const query = options.q?.trim().toLowerCase() ?? ''

  return models.filter((model) => {
    const matchCategory = category === 'all' || model.providers.includes(category)
    if (!matchCategory) return false

    if (!query) return true

    const haystack = [model.displayName, model.description, model.identifier].join(' ').toLowerCase()
    return haystack.includes(query)
  })
}
