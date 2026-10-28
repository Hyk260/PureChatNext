export const CHANNEL_HEARTBEAT_STALE_MS = 90_000

export function isChannelHeartbeatStale(lastHeartbeatAt: Date | null, now = Date.now()) {
  return !lastHeartbeatAt || now - lastHeartbeatAt.getTime() > CHANNEL_HEARTBEAT_STALE_MS
}

export function resolveWechatRuntimeStatus(input: {
  enabled: boolean
  failedEventCount: number
  gatewaySupported: boolean
  heartbeatStale: boolean
  needsRebind: boolean
  runtimeStatus: string
  waitingForFirstHeartbeat: boolean
}) {
  if (input.needsRebind) return 'needs_rebind'
  if (!input.enabled || !input.gatewaySupported) return 'offline'
  if (input.waitingForFirstHeartbeat) return 'starting'
  if (input.runtimeStatus === 'degraded' && input.heartbeatStale) return 'reconnecting'
  if (input.heartbeatStale) return 'offline'
  if (input.failedEventCount > 0) return 'degraded'
  return input.runtimeStatus
}
