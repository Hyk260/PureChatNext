import { deepseekChatModels, getDeepSeekModel } from './deepseek'
import { getOpenAIModel, openaiChatModels } from './openai'
import {
  assertPureChatPricingComplete,
  getEnabledPureChatModel,
  getPureChatModel,
  PURECHAT_DEFAULT_MODEL,
  PURECHAT_PLAN_CARD_MODELS,
  purechatChatModels,
  purechatEnabledChatModels,
  resolvePureChatDisplayId,
  resolvePureChatGatewayId,
} from './purechat'
import { ModelProvider } from '../const/modelProvider'
import type { ModelProviderId } from '../const/modelProvider'
import type { AiModelCard } from '../types/aiModel'

export const AI_MODELS_BY_PROVIDER: Record<ModelProviderId, AiModelCard[]> = {
  [ModelProvider.PureChat]: purechatChatModels,
  [ModelProvider.OpenAI]: openaiChatModels,
  [ModelProvider.DeepSeek]: deepseekChatModels,
}

export const getProviderChatModels = (provider: ModelProviderId): AiModelCard[] => AI_MODELS_BY_PROVIDER[provider] ?? []

export const getAiModel = (provider: ModelProviderId, modelId: string): AiModelCard | undefined => {
  switch (provider) {
    case ModelProvider.PureChat:
      return getPureChatModel(modelId)
    case ModelProvider.OpenAI:
      return getOpenAIModel(modelId)
    case ModelProvider.DeepSeek:
      return getDeepSeekModel(modelId)
    default:
      return undefined
  }
}

export {
  assertPureChatPricingComplete,
  deepseekChatModels,
  getDeepSeekModel,
  getEnabledPureChatModel,
  getOpenAIModel,
  getPureChatModel,
  openaiChatModels,
  PURECHAT_DEFAULT_MODEL,
  PURECHAT_PLAN_CARD_MODELS,
  purechatChatModels,
  purechatEnabledChatModels,
  resolvePureChatDisplayId,
  resolvePureChatGatewayId,
}
