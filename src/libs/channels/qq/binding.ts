import { QQApiClient } from '@pure/chat-adapter/qq'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'

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
  userId: string
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

  const binding = await model.upsert({
    agentId: params.agentId,
    applicationId: params.appId,
    credentials: encryptCredentials(credentials),
    platform: QQ_PLATFORM,
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
