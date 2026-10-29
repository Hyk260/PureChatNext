import { purechatFreeTierChatModels } from './purechatCatalog'
import type { AiModelCard } from '../types/aiModel'

export const purechatChatModels: AiModelCard[] = purechatFreeTierChatModels.map((model) =>
  model.id === 'gpt-5.4-nano' ? { ...model, recommended: true } : model
)

export const PURECHAT_DEFAULT_MODEL = 'gpt-5.4-nano'

export const PURECHAT_PLAN_CARD_MODELS = ['gpt-5.2', 'qwen3.5-plus', 'minimax-m2.7', 'mimo-v2.6-flash'] as const

const byId = new Map(purechatChatModels.map((model) => [model.id, model]))
const byGatewayId = new Map(purechatChatModels.map((model) => [model.gatewayId!, model]))

/** 面向用户和新请求的免费层可用模型。 */
export const purechatEnabledChatModels = purechatChatModels.filter((model) => model.enabled !== false)

const enabledById = new Map(purechatEnabledChatModels.map((model) => [model.id, model]))

export const getPureChatModel = (displayId: string) => byId.get(displayId)

export const getEnabledPureChatModel = (displayId: string) => enabledById.get(displayId)

export const resolvePureChatGatewayId = (displayId: string): string | undefined => byId.get(displayId)?.gatewayId

export const resolvePureChatDisplayId = (gatewayId: string): string | undefined => byGatewayId.get(gatewayId)?.id

/** 缺价或负价模型禁止上线 */
export const assertPureChatPricingComplete = () => {
  for (const model of purechatChatModels) {
    const { textInput, textOutput, currency } = model.pricing
    if (![textInput, textOutput].every((price) => Number.isFinite(price) && price >= 0)) {
      throw new Error(`PureChat model "${model.id}" has invalid pricing`)
    }
    if (currency !== 'USD') {
      throw new Error(`PureChat model "${model.id}" must use USD pricing`)
    }
    if (!model.gatewayId) {
      throw new Error(`PureChat model "${model.id}" missing gatewayId`)
    }
  }
}
