// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@pure/database/models/channelBinding', () => ({ ChannelBindingModel: class {} }))
vi.mock('@pure/database/models/channelEvent', () => ({ ChannelEventModel: class {} }))
vi.mock('@pure/utils', () => ({
  abortableDelay: (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }

      const timer = setTimeout(resolve, ms)
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true }
      )
    }),
  createNanoId: () => () => 'test-owner',
}))
vi.mock('@/libs/channels/wechat/processor', () => ({ runWechatProcessor: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./dbReady', () => ({ pingDatabase: vi.fn().mockResolvedValue(true) }))

import { ChannelGatewayManager } from './manager'
import type { ChannelGatewayClient, ChannelGatewayPlatformDefinition } from './types'
import type { ChannelBindingItem } from '@pure/database/schemas/channel'

function binding(overrides: Partial<ChannelBindingItem> = {}): ChannelBindingItem {
  const now = new Date('2026-08-12T00:00:00Z')
  return {
    accessedAt: now,
    agentId: 'agent-1',
    applicationId: 'app-1',
    createdAt: now,
    credentials: 'credential-v1',
    enabled: true,
    gatewayLeaseExpiresAt: null,
    gatewayLeaseOwner: null,
    id: 'binding-1',
    lastActiveAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastHeartbeatAt: null,
    model: null,
    needsRebind: false,
    pendingWelcome: false,
    platform: 'test',
    pollCursor: null,
    provider: null,
    runtimeStatus: 'stopped',
    updatedAt: now,
    userId: 'user-1',
    ...overrides,
  }
}

function pendingPromise() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function setup(overrides: { isDatabaseReady?: () => Promise<boolean> } = {}) {
  const bindings = [binding()]
  const clients: Array<ChannelGatewayClient & { stop: ReturnType<typeof vi.fn> }> = []
  const renewGatewayLease = vi.fn<(_id: string, _owner: string) => Promise<ChannelBindingItem | null>>(async () => bindings[0] ?? null)
  const model = {
    acquireGatewayLease: vi.fn(async (_id: string, _owner: string) => bindings[0] ?? null),
    findEnabledByPlatform: vi.fn(async () => [...bindings]),
    markNeedsRebind: vi.fn().mockResolvedValue(undefined),
    releaseGatewayLease: vi.fn().mockResolvedValue(undefined),
    renewGatewayLease,
    touchGatewayHeartbeat: vi.fn().mockResolvedValue(undefined),
    updateGatewayStatus: vi.fn().mockResolvedValue(undefined),
  }
  const definition: ChannelGatewayPlatformDefinition = {
    platform: 'test',
    transport: 'websocket',
    createClient: () => {
      const terminal = pendingPromise()
      const client = {
        done: terminal.promise,
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(async () => terminal.resolve()),
      }
      clients.push(client)
      return client
    },
    fingerprint: (item) => item.credentials,
    shouldManage: () => true,
  }
  const manager = new ChannelGatewayManager({
    bindingModel: model as never,
    definitions: [definition],
    eventModel: { pruneCompleted: vi.fn() } as never,
    isDatabaseReady: overrides.isDatabaseReady ?? (async () => true),
  })
  return { bindings, clients, manager, model }
}

describe('ChannelGatewayManager', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts once, stops idempotently, and can start again', async () => {
    const { clients, manager, model } = setup()
    await Promise.all([manager.ensureRunning(), manager.ensureRunning()])
    expect(model.acquireGatewayLease).toHaveBeenCalledTimes(1)
    expect(clients).toHaveLength(1)
    expect(manager.getSummary().platforms.test?.online).toBe(1)

    await Promise.all([manager.stop(), manager.stop()])
    expect(clients[0]?.stop).toHaveBeenCalledOnce()
    await manager.ensureRunning()
    expect(model.acquireGatewayLease).toHaveBeenCalledTimes(2)
    expect(clients).toHaveLength(2)
    await manager.stop()
  })

  it('reconciles binding deletion immediately', async () => {
    const { bindings, clients, manager, model } = setup()
    await manager.ensureRunning()
    bindings.splice(0)
    await manager.reconcileNow()
    expect(clients[0]?.stop).toHaveBeenCalledOnce()
    expect(model.releaseGatewayLease).toHaveBeenCalledOnce()
    expect(manager.getSummary().platforms.test?.active).toBe(0)
    await manager.stop()
  })

  it('does not restart a client for runtime-only binding updates', async () => {
    const { bindings, clients, manager, model } = setup()
    await manager.ensureRunning()
    bindings[0] = binding({ updatedAt: new Date('2026-08-12T00:01:00Z') })
    await manager.reconcileNow()
    expect(model.acquireGatewayLease).toHaveBeenCalledTimes(1)
    expect(clients).toHaveLength(1)
    expect(clients[0]?.stop).not.toHaveBeenCalled()
    await manager.stop()
  })

  it('stops a client when lease renewal fails', async () => {
    const { clients, manager, model } = setup()
    await manager.ensureRunning()
    model.renewGatewayLease.mockImplementationOnce(async () => null)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(clients[0]?.stop).toHaveBeenCalledOnce()
    expect(model.updateGatewayStatus).toHaveBeenCalledWith(
      'binding-1',
      'degraded',
      expect.objectContaining({ code: 'LEASE_LOST' })
    )
    await manager.stop()
  })

  it('waits for the database before starting workers', async () => {
    const isDatabaseReady = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const { manager, model } = setup({ isDatabaseReady })
    const started = manager.ensureRunning()
    await Promise.resolve()
    expect(model.findEnabledByPlatform).not.toHaveBeenCalled()
    expect(manager.getSummary().status).toBe('starting')

    await vi.advanceTimersByTimeAsync(1_000)
    await started
    expect(model.findEnabledByPlatform).toHaveBeenCalled()
    expect(manager.getSummary().status).toBe('healthy')
    await manager.stop()
  })

  it('aborts database wait without starting workers', async () => {
    const { manager, model } = setup({ isDatabaseReady: async () => false })
    const started = manager.ensureRunning()
    await Promise.resolve()
    await manager.stop()
    await expect(started).resolves.toBeUndefined()
    expect(model.findEnabledByPlatform).not.toHaveBeenCalled()
    expect(manager.getSummary().status).toBe('stopped')
  })
})
