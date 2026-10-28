import { NextResponse } from 'next/server'
import debug from 'debug'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { withAuth } from '@/libs/auth/get-session-user'
import { isWechatGatewaySupported } from '@/libs/channels/wechat'
import { CHANNEL_HEARTBEAT_STALE_MS, isChannelHeartbeatStale, resolveWechatRuntimeStatus } from '@/libs/channels/wechat/runtimeStatus'
import { ensureChannelGatewayRunning } from '@/server/channel-gateway'

const log = debug('channel:wechat:status')

/**
 * GET /api/channels/wechat/status
 * 当前用户微信连接状态（不含敏感凭证）
 */
export const GET = withAuth(async (_request, { userId }) => {
  ensureChannelGatewayRunning().catch((error) => {
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
      runtimeStatus: 'stopped',
    })
  }

  const heartbeatStale = isChannelHeartbeatStale(binding.lastHeartbeatAt)
  const waitingForFirstHeartbeat =
    binding.runtimeStatus === 'starting' &&
    !binding.lastHeartbeatAt &&
    Date.now() - binding.updatedAt.getTime() <= CHANNEL_HEARTBEAT_STALE_MS
  const failedEventCount = await new ChannelEventModel().countFailed(binding.id)
  const runtimeStatus = resolveWechatRuntimeStatus({
    enabled: binding.enabled,
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
    runtimeStatus,
  })
})
