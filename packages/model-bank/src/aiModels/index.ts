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
import { ModelProvider } from '@pure/const'
import type { ModelProviderId } from '@pure/const'
import type { AiModelCard } from '../types/aiModel'

export const AI_MODELS_BY_PROVIDER: Record<ModelProviderId, AiModelCard[]> = {
  [ModelProvider.PureChat]: purechatChatModels,
  [ModelProvider.OpenAI]: openaiChatModels,
  [ModelProvider.DeepSeek]: deepseekChatModels,
  [ModelProvider.Bailian]: [],
  [ModelProvider.OpenRouter]: [],
  [ModelProvider.LmStudio]: [],
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
    case ModelProvider.Bailian:
    case ModelProvider.OpenRouter:
    case ModelProvider.LmStudio:
      return undefined
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
