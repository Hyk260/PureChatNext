import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { getAiModel, PURECHAT_DEFAULT_MODEL } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import { isSupportedProviderId, resolveProviderApiKey } from '@/libs/ai-providers/resolveClient'
import { isPureChatRuntimeAvailable } from '@/server/purechat'

export const CHANNEL_PROVIDER_IDS = ['purechat', 'openai', 'deepseek'] as const
export type ChannelProviderId = (typeof CHANNEL_PROVIDER_IDS)[number]

export function isChannelProviderId(provider: string): provider is ChannelProviderId {
  return CHANNEL_PROVIDER_IDS.includes(provider as ChannelProviderId)
}

export function normalizeChannelProvider(provider: string | null | undefined, fallback: ChannelProviderId = 'deepseek') {
  return provider?.trim() || fallback
}

export function defaultChannelModel(provider: ChannelProviderId): string {
  if (provider === PURECHAT_PROVIDER_ID) return PURECHAT_DEFAULT_MODEL
  if (provider === 'openai') return 'gpt-5.4-mini'
  return 'deepseek-v4-flash'
}

export function validateChannelModel(provider: ChannelProviderId, model: string): string | null {
  const item = getAiModel(provider as ModelProviderId, model)
  return !item || item.enabled === false ? '所选模型不属于该服务商或已停用' : null
}

export type ChannelModelConfig = {
  model: string
  provider: ChannelProviderId
}

export type ChannelModelResolverParams = {
  channelName?: string
  fallbackProvider?: ChannelProviderId
  model?: string | null
  provider?: string | null
}

export class ChannelModelResolver {
  unavailableReason(provider: string | null | undefined, channelName = '渠道'): string | null {
    const normalized = normalizeChannelProvider(provider)
    if (normalized === PURECHAT_PROVIDER_ID) {
      return isPureChatRuntimeAvailable() ? null : '服务器未启用 PureChat 或未配置 AI Gateway 密钥'
    }
    if (!isChannelProviderId(normalized) || !isSupportedProviderId(normalized)) {
      return `该 Provider 不支持${channelName}`
    }
    return resolveProviderApiKey(normalized, undefined, undefined) ? null : `服务器未配置 ${normalized} 渠道密钥`
  }

  resolve(params: ChannelModelResolverParams): ChannelModelConfig {
    const fallbackProvider = params.fallbackProvider ?? 'deepseek'
    const providerRaw = normalizeChannelProvider(params.provider, fallbackProvider)
    const provider = isChannelProviderId(providerRaw) ? providerRaw : fallbackProvider
    const model = params.model?.trim() || defaultChannelModel(provider)
    return { model, provider }
  }
}

export const channelModelResolver = new ChannelModelResolver()

export function channelProviderUnavailableReason(
  provider: string | null | undefined,
  channelName = '渠道'
): string | null {
  return channelModelResolver.unavailableReason(provider, channelName)
}

export function resolveChannelModelConfig(params: ChannelModelResolverParams): ChannelModelConfig {
  return channelModelResolver.resolve(params)
}
