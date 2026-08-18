import { getAiModel, getProviderChatModels } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import {
  channelProviderUnavailableReason,
  defaultChannelModel,
  isChannelProviderId,
  normalizeChannelProvider,
  validateChannelModel,
} from '../core/modelResolver'

export function normalizeWechatAgentProvider(provider: string | null | undefined): string {
  return normalizeChannelProvider(provider)
}

export function resolveWechatAgentModelId(provider: string, model: string | null | undefined): string {
  const trimmed = model?.trim()
  if (trimmed) return trimmed
  return defaultChannelModel(isChannelProviderId(provider) ? provider : 'deepseek')
}

export const WECHAT_PROVIDER_IDS = ['purechat', 'openai', 'deepseek'] as const
export type WechatProviderId = (typeof WECHAT_PROVIDER_IDS)[number]

export function isWechatProviderId(provider: string): provider is WechatProviderId {
  return isChannelProviderId(provider)
}

export function getWechatProviderAvailability(): Record<WechatProviderId, { available: boolean; reason?: string }> {
  return Object.fromEntries(
    WECHAT_PROVIDER_IDS.map((provider) => {
      const reason = wechatAgentUnavailableReason(provider)
      return [provider, { available: !reason, ...(reason ? { reason } : {}) }]
    })
  ) as Record<WechatProviderId, { available: boolean; reason?: string }>
}

export function validateWechatModel(provider: WechatProviderId, model: string): string | null {
  return validateChannelModel(provider, model)
}

export function getEnabledWechatModels(provider: WechatProviderId) {
  return getProviderChatModels(provider as ModelProviderId).filter((model) => model.enabled !== false)
}

export function isWechatAgentUsable(provider: string | null | undefined): boolean {
  return !wechatAgentUnavailableReason(provider)
}

export function wechatAgentUnavailableReason(provider: string | null | undefined): string | null {
  const reason = channelProviderUnavailableReason(provider, '微信渠道')
  return reason === '该 Provider 不支持微信渠道' ? '该 Agent 的 Provider 不支持微信渠道' : reason
}

export function wechatModelSupportsVision(provider: string, modelId: string): boolean {
  return Boolean(getAiModel(provider as ModelProviderId, modelId)?.abilities?.vision)
}
