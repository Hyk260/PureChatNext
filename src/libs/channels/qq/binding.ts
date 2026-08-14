import { QQApiClient } from '@pure/chat-adapter/qq'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'

import { defaultQQModel, isQQProviderId, qqChannelUnavailableReason, validateQQModel } from './agentSupport'
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

function resolveQQChannelModel(params: {
  agentModel?: string | null
  agentProvider?: string | null
  model?: string
  previousModel?: string | null
  previousProvider?: string | null
  provider?: string
}): { model: string; provider: QQProviderId } {
  if (params.provider) {
    if (!isQQProviderId(params.provider)) throw new QQBindingError('该 Provider 不支持 QQ 渠道')
    const unavailable = qqChannelUnavailableReason(params.provider)
    if (unavailable) throw new QQBindingError(unavailable)
    const model = params.model || defaultQQModel(params.provider)
    const modelError = validateQQModel(params.provider, model)
    if (modelError) throw new QQBindingError(modelError)
    return { model, provider: params.provider }
  }

  const fallbackRaw = params.previousProvider || params.agentProvider || 'deepseek'
  const provider = isQQProviderId(fallbackRaw) ? fallbackRaw : 'deepseek'
  const unavailable = qqChannelUnavailableReason(provider)
  if (unavailable) throw new QQBindingError(unavailable)
  const model = params.model || params.previousModel || params.agentModel || defaultQQModel(provider)
  const modelError = validateQQModel(provider, model)
  if (modelError) throw new QQBindingError(modelError)
  return { model, provider }
}

/** Shared binding path for manual credentials and QR authorization. */
export async function bindQQCredentials(params: BindQQCredentialsParams) {
  const agent = await new AgentModel(params.userId).findVisibleById(params.agentId)
  if (!agent) throw new QQBindingError('Agent not found', 404)

  try {
    await new QQApiClient(params.appId, params.appSecret).getAccessToken()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QQ auth failed'
    throw new QQBindingError(`Invalid QQ credentials: ${message}`)
  }

  const credentials: QQCredentials = {
    appId: params.appId,
    appSecret: params.appSecret,
    connectionMode: params.connectionMode,
  }
  const model = new ChannelBindingModel()
  const previous = await model.findByUserAndPlatform(params.userId, QQ_PLATFORM)
  if (previous?.applicationId) invalidateQQChat(previous.applicationId)

  const channelModel = resolveQQChannelModel({
    agentModel: agent.model,
    agentProvider: agent.provider,
    model: params.model,
    previousModel: previous?.model,
    previousProvider: previous?.provider,
    provider: params.provider,
  })

  const binding = await model.upsert({
    agentId: params.agentId,
    applicationId: params.appId,
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
