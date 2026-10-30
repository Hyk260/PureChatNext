import { NextResponse } from 'next/server'
import debug from 'debug'

import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ServiceModelSettingsModel } from '@pure/database/models/serviceModelSettings'
import { DEFAULT_QQ_SPEECH_CONFIG } from '@pure/const'
import { appEnv } from '@/envs/app'
import { gatewayEnv } from '@/envs/gateway'
import { withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials, normalizeQQChannelSettings } from '@/libs/channels/qq'
import { isChannelHeartbeatFresh, resolveQqConnected, resolveQqRuntimeStatus } from '@/libs/channels/qq/runtimeStatus'
import { ensureChannelGatewayRunning } from '@/server/channel-gateway'

const log = debug('channel:qq:status')

function resolveAppBaseUrl(): string {
  const fromEnv = appEnv.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'http://localhost:3000'
}

/** GET /api/channels/qq/status — 当前用户 QQ 连接状态（不含 Secret） */
export const GET = withAuth(async (_request, { userId }) => {
  ensureChannelGatewayRunning().catch((error) => {
    log('gateway startup failed: %O', error)
  })
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

  const webhookUrl = new URL(
    `/api/channels/qq/webhook/${encodeURIComponent(binding.applicationId)}`,
    resolveAppBaseUrl()
  )
  const gatewaySupported = gatewayEnv.CHANNEL_GATEWAY_ENABLED
  const heartbeatFresh = isChannelHeartbeatFresh(binding.lastHeartbeatAt)
  const runtimeStatus = resolveQqRuntimeStatus({
    connectionMode,
    enabled: binding.enabled,
    gatewaySupported,
    heartbeatFresh,
    needsRebind: binding.needsRebind,
    runtimeStatus: binding.runtimeStatus,
  })
  const connected = resolveQqConnected(runtimeStatus)
  const settings = normalizeQQChannelSettings(binding.settings)
  const legacySpeechModel = (await new ServiceModelSettingsModel().get(userId)).qqSpeech
  settings.speechModel ??= legacySpeechModel
    ? {
        model: legacySpeechModel.model,
        provider: legacySpeechModel.provider,
        ...(legacySpeechModel.voice ? { voice: legacySpeechModel.voice } : {}),
      }
    : { model: DEFAULT_QQ_SPEECH_CONFIG.model, provider: DEFAULT_QQ_SPEECH_CONFIG.provider }

  return NextResponse.json({
    agentId: binding.agentId,
    appId,
    applicationId: binding.applicationId,
    connected,
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
    settings,
    webhookUrl: webhookUrl.toString(),
  })
})
