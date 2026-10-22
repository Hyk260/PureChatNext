import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { useMemo } from 'react'

import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'
import type { ProviderId } from '@/features/settings/provider/types'

export const useModelDetails = (provider: string, modelId: string) => {
  const card = useMemo(() => getAiModel(provider as ModelProviderId, modelId), [modelId, provider])
  const configuredModel = useProviderConfigStore((state) =>
    state.configs[provider as ProviderId]?.models.find((model) => model.id === modelId)
  )

  const description = card?.description?.trim()
  const pricing = card?.pricing
  const abilities = configuredModel?.abilities ?? card?.abilities
  const contextWindowTokens = configuredModel?.contextWindowTokens ?? card?.contextWindowTokens
  const hasAbilities = Boolean(
    abilities?.functionCall ||
      abilities?.vision ||
      abilities?.reasoning ||
      abilities?.structuredOutput ||
      abilities?.webSearch ||
      abilities?.imageGeneration
  )
  const hasContextWindow = typeof contextWindowTokens === 'number' && contextWindowTokens > 0
  const hasDetails = Boolean(description || pricing || hasAbilities || hasContextWindow)

  return { abilities, contextWindowTokens, description, hasAbilities, hasDetails, pricing }
}
