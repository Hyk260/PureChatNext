import {
  CHANNEL_PROVIDER_IDS,
  channelProviderByokUnavailableReason,
  defaultChannelModel,
  isChannelProviderId,
  validateChannelModel,
} from '../core/modelResolver'
import type { ChannelProviderId } from '../core/modelResolver'

export const QQ_PROVIDER_IDS = CHANNEL_PROVIDER_IDS
export type QQProviderId = ChannelProviderId

export function isQQProviderId(provider: string): provider is QQProviderId {
  return isChannelProviderId(provider)
}

export function defaultQQModel(provider: QQProviderId): string {
  return defaultChannelModel(provider)
}

export function validateQQModel(provider: QQProviderId, model: string): string | null {
  return validateChannelModel(provider, model)
}

export function qqChannelByokUnavailableReason(userId: string, provider: string | null | undefined) {
  return channelProviderByokUnavailableReason(userId, provider, 'QQ 渠道')
}
