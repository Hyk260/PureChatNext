import { NextResponse } from 'next/server'
import debug from 'debug'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { withAuth } from '@/libs/auth/get-session-user'
import { isWechatGatewaySupported } from '@/libs/channels/wechat'
import { getWechatProviderAvailability } from '@/libs/channels/wechat/agentSupport'
import { ensureChannelGatewayRunning } from '@/server/channel-gateway'

const log = debug('channel:wechat:status')

const HEARTBEAT_STALE_MS = 90_000

function resolveWechatRuntimeStatus(input: {
  failedEventCount: number
  gatewaySupported: boolean
  heartbeatStale: boolean
  needsRebind: boolean
  runtimeStatus: string
  waitingForFirstHeartbeat: boolean
}) {
  if (input.needsRebind) return 'needs_rebind'
  if (!input.gatewaySupported) return 'offline'
  if (input.waitingForFirstHeartbeat) return 'starting'
  if (input.runtimeStatus === 'degraded' && input.heartbeatStale) return 'reconnecting'
  if (input.heartbeatStale) return 'offline'
  if (input.failedEventCount > 0) return 'degraded'
  return input.runtimeStatus
}

/**
 * GET /api/channels/wechat/status
 * 当前用户微信连接状态（不含敏感凭证）
 */
export const GET = withAuth(async (_request, { userId }) => {
  void ensureChannelGatewayRunning().catch((error) => {
    log('gateway startup failed: %O', error)
  })
  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  const gatewaySupported = isWechatGatewaySupported()
  if (!binding) {
    return NextResponse.json({
      bound: false,
      connected: false,
      failedEventCount: 0,
      gatewaySupported,
      needsRebind: false,
      providerAvailability: getWechatProviderAvailability(),
      runtimeStatus: 'stopped',
    })
  }

  const heartbeatStale =
    !binding.lastHeartbeatAt || Date.now() - binding.lastHeartbeatAt.getTime() > HEARTBEAT_STALE_MS
  const waitingForFirstHeartbeat =
    binding.runtimeStatus === 'starting' &&
    !binding.lastHeartbeatAt &&
    Date.now() - binding.updatedAt.getTime() <= HEARTBEAT_STALE_MS
  const failedEventCount = await new ChannelEventModel().countFailed(binding.id)
  const runtimeStatus = resolveWechatRuntimeStatus({
    failedEventCount,
    gatewaySupported,
    heartbeatStale,
    needsRebind: binding.needsRebind,
    runtimeStatus: binding.runtimeStatus,
    waitingForFirstHeartbeat,
  })
  return NextResponse.json({
    agentId: binding.agentId,
    applicationId: binding.applicationId,
    bound: true,
    connected: runtimeStatus === 'online' || runtimeStatus === 'degraded',
    enabled: binding.enabled,
    failedEventCount,
    gatewaySupported,
    lastActiveAt: binding.lastActiveAt?.toISOString() ?? null,
    lastError: binding.lastErrorCode
      ? { code: binding.lastErrorCode, message: binding.lastErrorMessage || '微信渠道暂时异常' }
      : null,
    lastHeartbeatAt: binding.lastHeartbeatAt?.toISOString() ?? null,
    needsRebind: binding.needsRebind,
    model: binding.model,
    provider: binding.provider,
    providerAvailability: getWechatProviderAvailability(),
    runtimeStatus,
  })
})
