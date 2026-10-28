import { describe, expect, it } from 'vitest'

import { isChannelHeartbeatStale, resolveWechatRuntimeStatus } from './runtimeStatus'

describe('WeChat channel runtime status', () => {
  it('treats a disabled or unsupported binding as offline', () => {
    const input = {
      enabled: false,
      failedEventCount: 0,
      gatewaySupported: true,
      heartbeatStale: false,
      needsRebind: false,
      runtimeStatus: 'online',
      waitingForFirstHeartbeat: false,
    }

    expect(resolveWechatRuntimeStatus(input)).toBe('offline')
    expect(resolveWechatRuntimeStatus({ ...input, enabled: true, gatewaySupported: false })).toBe('offline')
  })

  it('prioritizes rebind and startup state before the heartbeat result', () => {
    const input = {
      enabled: true,
      failedEventCount: 0,
      gatewaySupported: true,
      heartbeatStale: true,
      needsRebind: false,
      runtimeStatus: 'starting',
      waitingForFirstHeartbeat: true,
    }

    expect(resolveWechatRuntimeStatus(input)).toBe('starting')
    expect(resolveWechatRuntimeStatus({ ...input, needsRebind: true })).toBe('needs_rebind')
  })

  it('reports failed events as degraded only when the binding is healthy', () => {
    const input = {
      enabled: true,
      failedEventCount: 2,
      gatewaySupported: true,
      heartbeatStale: false,
      needsRebind: false,
      runtimeStatus: 'online',
      waitingForFirstHeartbeat: false,
    }

    expect(resolveWechatRuntimeStatus(input)).toBe('degraded')
    expect(isChannelHeartbeatStale(new Date(9_000), 100_000)).toBe(true)
  })
})
