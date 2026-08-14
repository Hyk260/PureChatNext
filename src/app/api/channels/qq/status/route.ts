import { NextResponse } from 'next/server'

import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { appEnv } from '@/envs/app'
import { gatewayEnv } from '@/envs/gateway'
import { withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/qq'

function resolveAppBaseUrl(): string {
  const fromEnv = appEnv.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'http://localhost:3000'
}

/** GET /api/channels/qq/status — 当前用户 QQ 连接状态（不含 Secret） */
export const GET = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const binding = await model.findByUserAndPlatform(userId, QQ_PLATFORM)

  if (!binding) {
    return NextResponse.json({
      connected: false,
      gatewaySupported: gatewayEnv.CHANNEL_GATEWAY_ENABLED,
      runtimeStatus: 'stopped',
    })
  }

  let connectionMode: 'websocket' | 'webhook' = 'websocket'
  let appId = binding.applicationId
  try {
    const credentials = decryptCredentials(binding.credentials)
    connectionMode = credentials.connectionMode
    appId = credentials.appId || binding.applicationId
  } catch {
    /* credentials decrypt failure — still report connected */
  }

  const webhookUrl = `${resolveAppBaseUrl()}/api/channels/qq/webhook/${encodeURIComponent(binding.applicationId)}`
  const gatewaySupported = gatewayEnv.CHANNEL_GATEWAY_ENABLED
  const heartbeatFresh = Boolean(binding.lastHeartbeatAt && Date.now() - binding.lastHeartbeatAt.getTime() <= 90_000)
  const runtimeStatus = connectionMode === 'webhook'
    ? binding.enabled ? 'online' : 'offline'
    : !gatewaySupported || !heartbeatFresh ? 'offline' : binding.runtimeStatus

  return NextResponse.json({
    agentId: binding.agentId,
    appId,
    applicationId: binding.applicationId,
    connected: connectionMode === 'webhook' ? binding.enabled : runtimeStatus === 'online' || runtimeStatus === 'degraded',
    connectionMode,
    enabled: binding.enabled,
    gatewaySupported,
    lastActiveAt: binding.lastActiveAt?.toISOString() ?? null,
    lastError: binding.lastErrorCode
      ? { code: binding.lastErrorCode, message: binding.lastErrorMessage || 'QQ Gateway 暂时异常' }
      : null,
    lastHeartbeatAt: binding.lastHeartbeatAt?.toISOString() ?? null,
    model: binding.model,
    provider: binding.provider,
    runtimeStatus,
    webhookUrl,
  })
})
