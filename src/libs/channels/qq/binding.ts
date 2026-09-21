import { QQApiClient } from '@pure/chat-adapter/qq'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'

import { resolveAvailableChannelModel } from '../core/modelResolver'
import { isQQProviderId, qqChannelByokUnavailableReason, validateQQModel } from './agentSupport'
import type { QQProviderId } from './agentSupport'
import { invalidateQQChat } from './chatBot'
import { encryptCredentials } from './encrypt'
import type { QQConnectionMode, QQCredentials } from './encrypt'

export class QQBindingError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message)
    this.name = 'QQBindingError'
  }
}

export type BindQQCredentialsParams = {
  agentId: string
  appId: string
  appSecret: string
  connectionMode: QQConnectionMode
  model?: string
  provider?: string
  userId: string
}

export function resolveQQChannelModel(params: {
  model?: string
  previousModel?: string | null
  previousProvider?: string | null
  provider?: string
}): { model: string; provider: QQProviderId } {
  if (params.provider) {
    if (!isQQProviderId(params.provider)) throw new QQBindingError('该 Provider 不支持 QQ 渠道')
    const model = resolveAvailableChannelModel(params.provider, params.model)
    const modelError = validateQQModel(params.provider, model)
    if (modelError) throw new QQBindingError(modelError)
    return { model, provider: params.provider }
  }

  // QQ 为独立渠道：未显式选择且无历史绑定时，与微信一致默认 DeepSeek。
  const fallbackRaw = params.previousProvider || 'deepseek'
  const provider = isQQProviderId(fallbackRaw) ? fallbackRaw : 'deepseek'
  const model = resolveAvailableChannelModel(provider, params.model || params.previousModel)
  const modelError = validateQQModel(provider, model)
  if (modelError) throw new QQBindingError(modelError)
  return { model, provider }
}

/** Shared binding path for manual credentials and QR authorization. */
export async function bindQQCredentials(params: BindQQCredentialsParams) {
  const appId = params.appId.trim()
  const appSecret = params.appSecret.trim()
  const agent = await new AgentModel(params.userId).findVisibleById(params.agentId)
  if (!agent) throw new QQBindingError('Agent not found', 404)

  try {
    await new QQApiClient(appId, appSecret).getAccessToken()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QQ auth failed'
    throw new QQBindingError(`Invalid QQ credentials: ${message}`)
  }

  const credentials: QQCredentials = {
    appId,
    appSecret,
    connectionMode: params.connectionMode,
  }
  const model = new ChannelBindingModel()
  const previous = await model.findByUserAndPlatform(params.userId, QQ_PLATFORM)
  if (previous?.applicationId) await invalidateQQChat(previous.applicationId)

  const channelModel = resolveQQChannelModel({
    model: params.model,
    previousModel: previous?.model,
    previousProvider: previous?.provider,
    provider: params.provider,
  })
  const unavailable = await qqChannelByokUnavailableReason(params.userId, channelModel.provider)
  if (unavailable) throw new QQBindingError(unavailable)

  const binding = await model.upsert({
    agentId: params.agentId,
    applicationId: appId,
    credentials: encryptCredentials(credentials),
    model: channelModel.model,
    platform: QQ_PLATFORM,
    provider: channelModel.provider,
    userId: params.userId,
  })

  const { reconcileChannelGateway } = await import('@/server/channel-gateway')
  await reconcileChannelGateway()

  return {
    agentId: binding.agentId,
    applicationId: binding.applicationId,
    connectionMode: params.connectionMode,
    enabled: binding.enabled,
    id: binding.id,
    ok: true as const,
  }
}
