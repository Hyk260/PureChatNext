export const CHANNEL_HEARTBEAT_STALE_MS = 90_000

export type QQConnectionMode = 'websocket' | 'webhook'

export function isChannelHeartbeatFresh(lastHeartbeatAt: Date | null, now = Date.now()) {
  return Boolean(lastHeartbeatAt && now - lastHeartbeatAt.getTime() <= CHANNEL_HEARTBEAT_STALE_MS)
}

export function resolveQqRuntimeStatus(input: {
  connectionMode: QQConnectionMode
  enabled: boolean
  gatewaySupported: boolean
  heartbeatFresh: boolean
  needsRebind: boolean
  runtimeStatus: string
}) {
  if (input.needsRebind) return 'needs_rebind'
  if (!input.enabled) return 'offline'
  if (input.connectionMode === 'webhook') return 'online'
  if (!input.gatewaySupported || !input.heartbeatFresh) return 'offline'
  return input.runtimeStatus
}

export function resolveQqConnected(runtimeStatus: string) {
  return runtimeStatus === 'online' || runtimeStatus === 'degraded'
}
