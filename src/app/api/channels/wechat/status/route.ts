import { NextResponse } from 'next/server'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { withAuth } from '@/libs/auth/get-session-user'
import { isWechatGatewaySupported } from '@/libs/channels/wechat'
import { getWechatProviderAvailability } from '@/libs/channels/wechat/agentSupport'

const HEARTBEAT_STALE_MS = 90_000

export const GET = withAuth(async (_request, { userId }) => {
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

  const heartbeatStale = !binding.lastHeartbeatAt || Date.now() - binding.lastHeartbeatAt.getTime() > HEARTBEAT_STALE_MS
  const waitingForFirstHeartbeat =
    binding.runtimeStatus === 'starting' &&
    !binding.lastHeartbeatAt &&
    Date.now() - binding.updatedAt.getTime() <= HEARTBEAT_STALE_MS
  const failedEventCount = await new ChannelEventModel().countFailed(binding.id)
  const runtimeStatus = binding.needsRebind
    ? 'needs_rebind'
    : !gatewaySupported
      ? 'offline'
      : waitingForFirstHeartbeat
        ? 'starting'
        : heartbeatStale
          ? 'offline'
      : failedEventCount > 0
        ? 'degraded'
        : binding.runtimeStatus
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
