import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { getAiModel, PURECHAT_DEFAULT_MODEL } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import { isSupportedProviderId, resolveProviderApiKey } from '@/libs/ai-providers/resolveClient'
import { isPureChatRuntimeAvailable } from '@/server/purechat'

export const QQ_PROVIDER_IDS = ['purechat', 'openai', 'deepseek'] as const
export type QQProviderId = (typeof QQ_PROVIDER_IDS)[number]

export function isQQProviderId(provider: string): provider is QQProviderId {
  return QQ_PROVIDER_IDS.includes(provider as QQProviderId)
}

export function defaultQQModel(provider: QQProviderId): string {
  if (provider === PURECHAT_PROVIDER_ID) return PURECHAT_DEFAULT_MODEL
  if (provider === 'openai') return 'gpt-5.4-mini'
  return 'deepseek-v4-flash'
}

export function validateQQModel(provider: QQProviderId, model: string): string | null {
  const item = getAiModel(provider as ModelProviderId, model)
  if (!item || item.enabled === false) return '所选模型不属于该服务商或已停用'
  return null
}

export function qqChannelUnavailableReason(provider: string | null | undefined): string | null {
  const normalized = provider?.trim() || 'deepseek'
  if (normalized === PURECHAT_PROVIDER_ID) {
    if (!isPureChatRuntimeAvailable()) return '服务器未启用 PureChat 或未配置 AI Gateway 密钥'
    return null
  }
  if (!isSupportedProviderId(normalized)) return '该 Provider 不支持 QQ 渠道'
  if (!resolveProviderApiKey(normalized, undefined, undefined)) return `服务器未配置 ${normalized} 渠道密钥`
  return null
}
