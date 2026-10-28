import { describe, expect, it } from 'vitest'

import { isChannelHeartbeatFresh, resolveQqConnected, resolveQqRuntimeStatus } from './runtimeStatus'

describe('QQ channel runtime status', () => {
  it('reports enabled webhook bindings online without a gateway heartbeat', () => {
    const runtimeStatus = resolveQqRuntimeStatus({
      connectionMode: 'webhook',
      enabled: true,
      gatewaySupported: false,
      heartbeatFresh: false,
      needsRebind: false,
      runtimeStatus: 'offline',
    })

    expect(runtimeStatus).toBe('online')
    expect(resolveQqConnected(runtimeStatus)).toBe(true)
  })

  it('reports disabled or rebind-required bindings as offline states', () => {
    const input = {
      connectionMode: 'webhook' as const,
      enabled: false,
      gatewaySupported: true,
      heartbeatFresh: true,
      needsRebind: false,
      runtimeStatus: 'online',
    }

    expect(resolveQqRuntimeStatus(input)).toBe('offline')
    expect(resolveQqRuntimeStatus({ ...input, needsRebind: true })).toBe('needs_rebind')
  })

  it('requires a fresh supported gateway for websocket bindings', () => {
    const input = {
      connectionMode: 'websocket' as const,
      enabled: true,
      gatewaySupported: true,
      heartbeatFresh: false,
      needsRebind: false,
      runtimeStatus: 'online',
    }

    expect(resolveQqRuntimeStatus(input)).toBe('offline')
    expect(isChannelHeartbeatFresh(new Date(9_000), 100_000)).toBe(false)
    expect(resolveQqRuntimeStatus({ ...input, heartbeatFresh: true })).toBe('online')
  })
})
