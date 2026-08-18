// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enabled: true,
  ensureRunning: vi.fn().mockResolvedValue(undefined),
  getSummary: vi.fn(),
  reconcileNow: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/envs/gateway', () => ({
  get gatewayEnv() {
    return { CHANNEL_GATEWAY_ENABLED: mocks.enabled }
  },
}))
vi.mock('./manager', () => ({
  ChannelGatewayManager: class {
    ensureRunning = mocks.ensureRunning
    getSummary = mocks.getSummary
    reconcileNow = mocks.reconcileNow
    stop = mocks.stop
  },
}))
vi.mock('./platforms/wechat', () => ({ wechatGatewayPlatform: { platform: 'wechat' } }))
vi.mock('./platforms/qq', () => ({ qqGatewayPlatform: { platform: 'qq' } }))

const MANAGER_KEY = Symbol.for('purechat.channel-gateway.manager')

describe('channel-gateway index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enabled = true
    mocks.ensureRunning.mockResolvedValue(undefined)
    mocks.reconcileNow.mockResolvedValue(undefined)
    delete (globalThis as typeof globalThis & { [MANAGER_KEY]?: unknown })[MANAGER_KEY]
  })

  afterEach(() => {
    delete (globalThis as typeof globalThis & { [MANAGER_KEY]?: unknown })[MANAGER_KEY]
  })

  it('starts the manager when reconciling if instrumentation did not store one', async () => {
    const { reconcileChannelGateway } = await import('./index')
    await reconcileChannelGateway()
    await vi.waitFor(() => {
      expect(mocks.ensureRunning).toHaveBeenCalledOnce()
      expect(mocks.reconcileNow).toHaveBeenCalledOnce()
    })
  })

  it('does not start a manager when the gateway is disabled', async () => {
    mocks.enabled = false
    const { reconcileChannelGateway } = await import('./index')
    await reconcileChannelGateway()
    await Promise.resolve()
    await Promise.resolve()
    expect(mocks.ensureRunning).not.toHaveBeenCalled()
    expect(mocks.reconcileNow).not.toHaveBeenCalled()
  })
})
