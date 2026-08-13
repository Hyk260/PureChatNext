import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials, encryptCredentials, invalidateQQChat } from '@/libs/channels/qq'
import type { QQConnectionMode } from '@/libs/channels/qq'
import { bindQQCredentials, QQBindingError } from '@/libs/channels/qq/binding'
import { gatewayEnv } from '@/envs/gateway'

const requestGatewayReconcile = async () => {
  const { reconcileChannelGateway } = await import('@/server/channel-gateway')
  await reconcileChannelGateway()
}

function parseConnectionMode(value: unknown): QQConnectionMode {
  return value === 'webhook' ? 'webhook' : 'websocket'
}

/** POST /api/channels/qq/bind — 保存 AppID/Secret 并校验凭证 */
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  let body: {
    agentId?: string
    appId?: string
    appSecret?: string
    connectionMode?: string
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
    return NextResponse.json(await bindQQCredentials({ agentId, appId, appSecret, connectionMode, userId }))
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

/** PATCH /api/channels/qq/bind — 更新绑定的 Agent（或 connectionMode） */
export const PATCH = withAuth(async (request: NextRequest, { userId }) => {
  let body: { agentId?: string; connectionMode?: string }
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

  const agentId = body.agentId?.trim()
  if (agentId) {
    const agentModel = new AgentModel(userId)
    const agent = await agentModel.findVisibleById(agentId)
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
        platform: QQ_PLATFORM,
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
      platform: QQ_PLATFORM,
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
