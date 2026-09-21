import { getAiModel, getProviderChatModels } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import {
  CHANNEL_PROVIDER_IDS,
  channelProviderByokUnavailableReason,
  isChannelProviderId,
  normalizeChannelProvider,
  resolveAvailableChannelModel,
  validateChannelModel,
} from '../core/modelResolver'
import type { ChannelProviderId } from '../core/modelResolver'

export function normalizeWechatAgentProvider(provider: string | null | undefined): string {
  return normalizeChannelProvider(provider)
}

export function resolveWechatAgentModelId(provider: string, model: string | null | undefined): string {
  return resolveAvailableChannelModel(isChannelProviderId(provider) ? provider : 'deepseek', model)
}

export const WECHAT_PROVIDER_IDS = CHANNEL_PROVIDER_IDS
export type WechatProviderId = ChannelProviderId

export function isWechatProviderId(provider: string): provider is WechatProviderId {
  return isChannelProviderId(provider)
}

export function validateWechatModel(provider: WechatProviderId, model: string): string | null {
  return validateChannelModel(provider, model)
}

export function getEnabledWechatModels(provider: WechatProviderId) {
  return getProviderChatModels(provider as ModelProviderId).filter((model) => model.enabled !== false)
}

export function wechatModelSupportsVision(provider: string, modelId: string): boolean {
  return Boolean(getAiModel(provider as ModelProviderId, modelId)?.abilities?.vision)
}

export function wechatChannelByokUnavailableReason(userId: string, provider: string | null | undefined) {
  return channelProviderByokUnavailableReason(userId, provider, '微信渠道')
}
