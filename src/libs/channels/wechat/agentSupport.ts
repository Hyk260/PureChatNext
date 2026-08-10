import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { getAiModel, getProviderChatModels, PURECHAT_DEFAULT_MODEL } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import { isSupportedProviderId, resolveProviderApiKey } from '@/libs/ai-providers/resolveClient'
import { isPureChatRuntimeAvailable } from '@/server/purechat'

export function normalizeWechatAgentProvider(provider: string | null | undefined): string {
  return provider?.trim() || 'deepseek'
}

export function resolveWechatAgentModelId(provider: string, model: string | null | undefined): string {
  const trimmed = model?.trim()
  if (trimmed) return trimmed
  if (provider === PURECHAT_PROVIDER_ID) return PURECHAT_DEFAULT_MODEL
  if (provider === 'openai') return 'gpt-5.4-mini'
  return 'deepseek-v4-flash'
}

export const WECHAT_PROVIDER_IDS = ['purechat', 'openai', 'deepseek'] as const
export type WechatProviderId = (typeof WECHAT_PROVIDER_IDS)[number]

export function isWechatProviderId(provider: string): provider is WechatProviderId {
  return WECHAT_PROVIDER_IDS.includes(provider as WechatProviderId)
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
  const item = getAiModel(provider as ModelProviderId, model)
  if (!item || item.enabled === false) return '所选模型不属于该服务商或已停用'
  return null
}

export function getEnabledWechatModels(provider: WechatProviderId) {
  return getProviderChatModels(provider as ModelProviderId).filter((model) => model.enabled !== false)
}

export function isWechatAgentUsable(provider: string | null | undefined): boolean {
  const normalized = normalizeWechatAgentProvider(provider)
  if (normalized === PURECHAT_PROVIDER_ID) return isPureChatRuntimeAvailable()
  if (normalized === 'openai') return Boolean(resolveProviderApiKey('openai', undefined, undefined))
  if (normalized === 'deepseek') return Boolean(resolveProviderApiKey('deepseek', undefined, undefined))
  return false
}

export function wechatAgentUnavailableReason(provider: string | null | undefined): string | null {
  const normalized = normalizeWechatAgentProvider(provider)
  if (normalized === PURECHAT_PROVIDER_ID) {
    if (!isPureChatRuntimeAvailable()) return '服务器未启用 PureChat 或未配置 AI Gateway 密钥'
    return null
  }
  if (!isSupportedProviderId(normalized)) return '该 Agent 的 Provider 不支持微信渠道'
  if (!resolveProviderApiKey(normalized, undefined, undefined)) return `服务器未配置 ${normalized} 渠道密钥`
  return null
}

export function wechatModelSupportsVision(provider: string, modelId: string): boolean {
  return Boolean(getAiModel(provider as ModelProviderId, modelId)?.abilities?.vision)
}
