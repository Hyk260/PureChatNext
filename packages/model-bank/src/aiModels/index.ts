import { deepseekChatModels, getDeepSeekModel } from './deepseek'
import { getOpenAIModel, openaiChatModels } from './openai'
import {
  assertPureHubPricingComplete,
  getEnabledPureHubModel,
  getPureHubModel,
  PUREHUB_DEFAULT_MODEL,
  PUREHUB_PLAN_CARD_MODELS,
  purehubChatModels,
  purehubEnabledChatModels,
  resolvePureHubDisplayId,
  resolvePureHubGatewayId,
} from './purehub'
import { ModelProvider, type ModelProviderId } from '../const/modelProvider'
import { type AiModelCard } from '../types/aiModel'

export const AI_MODELS_BY_PROVIDER: Record<ModelProviderId, AiModelCard[]> = {
  [ModelProvider.PureHub]: purehubChatModels,
  [ModelProvider.OpenAI]: openaiChatModels,
  [ModelProvider.DeepSeek]: deepseekChatModels,
}

export const getProviderChatModels = (provider: ModelProviderId): AiModelCard[] =>
  AI_MODELS_BY_PROVIDER[provider] ?? []

export const getAiModel = (provider: ModelProviderId, modelId: string): AiModelCard | undefined => {
  switch (provider) {
    case ModelProvider.PureHub:
      return getPureHubModel(modelId)
    case ModelProvider.OpenAI:
      return getOpenAIModel(modelId)
    case ModelProvider.DeepSeek:
      return getDeepSeekModel(modelId)
    default:
      return undefined
  }
}

export {
  assertPureHubPricingComplete,
  deepseekChatModels,
  getDeepSeekModel,
  getEnabledPureHubModel,
  getOpenAIModel,
  getPureHubModel,
  openaiChatModels,
  PUREHUB_DEFAULT_MODEL,
  PUREHUB_PLAN_CARD_MODELS,
  purehubChatModels,
  purehubEnabledChatModels,
  resolvePureHubDisplayId,
  resolvePureHubGatewayId,
}
