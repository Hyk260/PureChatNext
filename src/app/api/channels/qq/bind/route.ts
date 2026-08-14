import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials, encryptCredentials, invalidateQQChat } from '@/libs/channels/qq'
import type { QQConnectionMode } from '@/libs/channels/qq'
import { isQQProviderId, qqChannelUnavailableReason, validateQQModel } from '@/libs/channels/qq/agentSupport'
import type { QQProviderId } from '@/libs/channels/qq/agentSupport'
import { bindQQCredentials, QQBindingError } from '@/libs/channels/qq/binding'
import { gatewayEnv } from '@/envs/gateway'

const requestGatewayReconcile = async () => {
  const { reconcileChannelGateway } = await import('@/server/channel-gateway')
  await reconcileChannelGateway()
}

function parseConnectionMode(value: unknown): QQConnectionMode {
  return value === 'webhook' ? 'webhook' : 'websocket'
}

type ParsedQQChannelConfig =
  | { ok: true; agentId: string; model: string; provider: QQProviderId }
  | { ok: false; error: string; status: 400 }

function parseChannelConfig(body: {
  agentId?: string
  model?: string
  provider?: string
}): ParsedQQChannelConfig | null {
  const agentId = body.agentId?.trim()
  const model = body.model?.trim()
  const provider = body.provider?.trim()
  if (!agentId || !model || !provider) return null
  if (!isQQProviderId(provider)) return { ok: false, error: '该 Provider 不支持 QQ 渠道', status: 400 }
  const unavailable = qqChannelUnavailableReason(provider)
  if (unavailable) return { ok: false, error: unavailable, status: 400 }
  const modelError = validateQQModel(provider, model)
  if (modelError) return { ok: false, error: modelError, status: 400 }
  return { ok: true, agentId, model, provider }
}

/** POST /api/channels/qq/bind — 保存 AppID/Secret 并校验凭证 */
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  let body: {
    agentId?: string
    appId?: string
    appSecret?: string
    connectionMode?: string
    model?: string
    provider?: string
  }

  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const appId = body.appId?.trim()
  const appSecret = body.appSecret?.trim()
  const agentId = body.agentId?.trim()
  if (!appId) return jsonError('appId is required')
  if (!appSecret) return jsonError('appSecret is required')
  if (!agentId) return jsonError('agentId is required')

  const connectionMode = parseConnectionMode(body.connectionMode)
  if (connectionMode === 'websocket' && !gatewayEnv.CHANNEL_GATEWAY_ENABLED) {
    return jsonError('QQ WebSocket gateway is not supported in this deployment', 409)
  }

  try {
    return NextResponse.json(
      await bindQQCredentials({
        agentId,
        appId,
        appSecret,
        connectionMode,
        model: body.model?.trim(),
        provider: body.provider?.trim(),
        userId,
      })
    )
  } catch (error) {
    if (error instanceof QQBindingError) return jsonError(error.message, error.status)
    throw error
  }
})

/** DELETE /api/channels/qq/bind — 断开 QQ 连接 */
export const DELETE = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const existing = await model.findByUserAndPlatform(userId, QQ_PLATFORM)
  if (existing?.applicationId) {
    invalidateQQChat(existing.applicationId)
  }
  await model.disconnect(userId, QQ_PLATFORM)
  await requestGatewayReconcile()
  return NextResponse.json({ ok: true })
})

/** PATCH /api/channels/qq/bind — 更新绑定的 Agent、模型或 connectionMode */
export const PATCH = withAuth(async (request: NextRequest, { userId }) => {
  let body: { agentId?: string; connectionMode?: string; model?: string; provider?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const model = new ChannelBindingModel()
  const existing = await model.findByUserAndPlatform(userId, QQ_PLATFORM)
  if (!existing) return jsonError('QQ not connected', 404)

  if (body.connectionMode !== undefined && parseConnectionMode(body.connectionMode) === 'websocket' && !gatewayEnv.CHANNEL_GATEWAY_ENABLED) {
    return jsonError('QQ WebSocket gateway is not supported in this deployment', 409)
  }

  if (existing.applicationId) {
    invalidateQQChat(existing.applicationId)
  }

  const channelConfig = parseChannelConfig(body)
  if (channelConfig?.ok === false) return jsonError(channelConfig.error, channelConfig.status)

  if (channelConfig) {
    const agent = await new AgentModel(userId).findVisibleById(channelConfig.agentId)
    if (!agent) return jsonError('Agent not found', 404)

    const updated = await model.updateConfiguration({
      agentId: channelConfig.agentId,
      model: channelConfig.model,
      platform: QQ_PLATFORM,
      provider: channelConfig.provider,
      userId,
    })
    if (!updated) return jsonError('QQ not connected', 404)

    if (body.connectionMode !== undefined) {
      const creds = decryptCredentials(existing.credentials)
      creds.connectionMode = parseConnectionMode(body.connectionMode)
      await model.upsert({
        agentId: updated.agentId,
        applicationId: existing.applicationId,
        credentials: encryptCredentials(creds),
        model: updated.model,
        platform: QQ_PLATFORM,
        provider: updated.provider,
        userId,
      })
      await requestGatewayReconcile()
    }

    return NextResponse.json({
      agentId: updated.agentId,
      model: updated.model,
      ok: true,
      provider: updated.provider,
    })
  }

  const agentId = body.agentId?.trim()
  if (agentId) {
    const agent = await new AgentModel(userId).findVisibleById(agentId)
    if (!agent) return jsonError('Agent not found', 404)

    const updated = await model.updateAgent(userId, QQ_PLATFORM, agentId)
    if (!updated) return jsonError('QQ not connected', 404)

    if (body.connectionMode !== undefined) {
      const creds = decryptCredentials(existing.credentials)
      creds.connectionMode = parseConnectionMode(body.connectionMode)
      await model.upsert({
        agentId: updated.agentId,
        applicationId: existing.applicationId,
        credentials: encryptCredentials(creds),
        model: existing.model,
        platform: QQ_PLATFORM,
        provider: existing.provider,
        userId,
      })
      await requestGatewayReconcile()
    }

    return NextResponse.json({
      agentId: updated.agentId,
      ok: true,
    })
  }

  if (body.connectionMode !== undefined) {
    const creds = decryptCredentials(existing.credentials)
    creds.connectionMode = parseConnectionMode(body.connectionMode)
    const updated = await model.upsert({
      agentId: existing.agentId,
      applicationId: existing.applicationId,
      credentials: encryptCredentials(creds),
      model: existing.model,
      platform: QQ_PLATFORM,
      provider: existing.provider,
      userId,
    })
    await requestGatewayReconcile()
    return NextResponse.json({
      agentId: updated.agentId,
      connectionMode: creds.connectionMode,
      ok: true,
    })
  }

  return jsonError('agentId or connectionMode is required')
})
