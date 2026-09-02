import { hostname } from 'node:os'

import debug from 'debug'

import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { abortableDelay, createNanoId } from '@pure/utils'

import { pingDatabase } from './dbReady'
import type {
  ChannelGatewayClient,
  ChannelGatewayPlatformDefinition,
  ChannelGatewayPlatformSummary,
  ChannelGatewayRuntimeStatus,
  ChannelGatewayStatusEvent,
  ChannelGatewaySummary,
} from './types'
import type { ChannelBindingItem } from '@pure/database/schemas/channel'

const log = debug('channel:gateway:manager')
const RECONCILE_INTERVAL_MS = 5_000
const LEASE_TTL_MS = 90_000
const LEASE_RENEW_INTERVAL_MS = 30_000
const MAX_BACKOFF_MS = 30_000
const PROCESSOR_COUNT = 4
const DB_WAIT_INITIAL_MS = 1_000
const DB_WAIT_MAX_MS = 15_000

type ActiveClient = {
  binding: ChannelBindingItem
  client: ChannelGatewayClient
  definition: ChannelGatewayPlatformDefinition
  expectedStop: boolean
  fingerprint: string
  leaseTimer: ReturnType<typeof setInterval>
  status: ChannelGatewayRuntimeStatus
}

type RetryState = { attempt: number; retryAt: number }
type RetrySchedule = RetryState & { delayMs: number }

type ManagerOptions = {
  bindingModel?: ChannelBindingModel
  definitions: ChannelGatewayPlatformDefinition[]
  eventModel?: ChannelEventModel
  isDatabaseReady?: () => Promise<boolean>
  now?: () => number
}

function safeError(error: unknown): { code: string; message: string } {
  const code = String((error as { code?: string; name?: string })?.code || (error as Error)?.name || 'GATEWAY_ERROR')
  return { code: code.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 100), message: 'Channel gateway unavailable' }
}

function resolveGatewaySummaryStatus(input: {
  coreError?: string
  degraded: boolean
  running: boolean
  waitingForDatabase: boolean
}): ChannelGatewaySummary['status'] {
  if (input.coreError) return 'unhealthy'
  if (input.waitingForDatabase) return 'starting'
  if (!input.running) return 'stopped'
  if (input.degraded) return 'degraded'
  return 'healthy'
}

export class ChannelGatewayManager {
  private readonly active = new Map<string, ActiveClient>()
  private readonly bindingModel: ChannelBindingModel
  private readonly definitions: ChannelGatewayPlatformDefinition[]
  private readonly eventModel: ChannelEventModel
  private readonly isDatabaseReady: () => Promise<boolean>
  private readonly now: () => number
  private readonly owner = `next-${hostname()}-${process.pid}-${createNanoId(8)()}`
  private readonly retry = new Map<string, RetryState>()
  private readonly loggedFailures = new Map<string, string>()
  private readonly statuses = new Map<string, ChannelGatewayRuntimeStatus>()
  private abortController: AbortController | null = null
  private coreError: string | undefined
  private degradedCounts = new Map<string, number>()
  private desiredCounts = new Map<string, number>()
  private reconcilePromise: Promise<void> | null = null
  private reconcileTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private startPromise: Promise<void> | null = null
  private waitingForDatabase = false
  private workerTasks: Promise<void>[] = []

  constructor(options: ManagerOptions) {
    this.bindingModel = options.bindingModel ?? new ChannelBindingModel()
    this.definitions = options.definitions
    this.eventModel = options.eventModel ?? new ChannelEventModel()
    this.isDatabaseReady = options.isDatabaseReady ?? pingDatabase
    this.now = options.now ?? Date.now
  }

  ensureRunning(): Promise<void> {
    if (this.running) return Promise.resolve()
    if (this.startPromise) return this.startPromise
    this.startPromise = this.start().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async start(): Promise<void> {
    this.coreError = undefined
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    try {
      await this.waitUntilDatabaseReady(signal)
      if (signal.aborted) return
      this.running = true
      this.waitingForDatabase = false
      await this.startWorkers(signal)
      await this.reconcileNow()
      this.reconcileTimer = setInterval(() => {
        void this.reconcileNow().catch((error) => this.recordCoreError(error))
      }, RECONCILE_INTERVAL_MS)
    } catch (error) {
      this.waitingForDatabase = false
      if (signal.aborted) return
      this.recordCoreError(error)
      await this.stop()
      throw error
    }
  }

  private async waitUntilDatabaseReady(signal: AbortSignal) {
    if (await this.isDatabaseReady()) return
    this.waitingForDatabase = true
    log('database not ready, waiting to start gateway')
    let delay = DB_WAIT_INITIAL_MS
    while (!signal.aborted) {
      log('database unavailable, retry in %dms', delay)
      await abortableDelay(delay, signal)
      if (signal.aborted) return
      if (await this.isDatabaseReady()) {
        log('database ready, starting gateway')
        return
      }
      delay = Math.min(delay * 2, DB_WAIT_MAX_MS)
    }
  }

  private async startWorkers(signal: AbortSignal) {
    const { runWechatProcessor } = await import('@/libs/channels/wechat/processor')
    this.workerTasks = Array.from({ length: PROCESSOR_COUNT }, () => runWechatProcessor(signal))
    this.workerTasks.push(this.runMaintenance(signal))
  }

  private async runMaintenance(signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        await this.eventModel.pruneCompleted(new Date(this.now() - 30 * 24 * 60 * 60 * 1000))
      } catch (error) {
        log('maintenance failed: %O', error)
      }
      await abortableDelay(24 * 60 * 60 * 1000, signal)
    }
  }

  reconcileNow(): Promise<void> {
    if (!this.running) return Promise.resolve()
    if (this.reconcilePromise) return this.reconcilePromise
    this.reconcilePromise = this.reconcile().finally(() => {
      this.reconcilePromise = null
    })
    return this.reconcilePromise
  }

  private async reconcile() {
    const desired = new Map<string, { binding: ChannelBindingItem; definition: ChannelGatewayPlatformDefinition; fingerprint: string }>()
    const desiredCounts = new Map<string, number>()
    const degradedCounts = new Map<string, number>()

    for (const definition of this.definitions) {
      const bindings = await this.bindingModel.findEnabledByPlatform(definition.platform)
      for (const binding of bindings) {
        try {
          if (!(await definition.shouldManage(binding))) continue
          const fingerprint = await definition.fingerprint(binding)
          desired.set(binding.id, { binding, definition, fingerprint })
          desiredCounts.set(definition.platform, (desiredCounts.get(definition.platform) ?? 0) + 1)
        } catch (error) {
          degradedCounts.set(definition.platform, (degradedCounts.get(definition.platform) ?? 0) + 1)
          await this.reportStatus(binding.id, { ...safeError(error), status: 'degraded' })
        }
      }
    }
    this.desiredCounts = desiredCounts
    this.degradedCounts = degradedCounts

    await Promise.all(
      [...this.active].map(async ([bindingId, active]) => {
        const target = desired.get(bindingId)
        if (!target || target.fingerprint !== active.fingerprint) await this.stopClient(bindingId, true)
      })
    )

    await Promise.all(
      [...desired].map(async ([bindingId, target]) => {
        if (this.active.has(bindingId)) return
        const retry = this.retry.get(bindingId)
        if (retry && retry.retryAt > this.now()) return
        await this.startClient(target.binding, target.definition, target.fingerprint)
      })
    )
  }

  private async startClient(
    binding: ChannelBindingItem,
    definition: ChannelGatewayPlatformDefinition,
    fingerprint: string
  ) {
    const leased = await this.bindingModel.acquireGatewayLease(binding.id, this.owner, LEASE_TTL_MS)
    if (!leased || !this.running) return
    await this.reportStatus(binding.id, { status: 'starting' })

    let client: ChannelGatewayClient | undefined
    try {
      client = await definition.createClient({
        binding: leased,
        reportStatus: (event) => void this.reportStatus(binding.id, event),
      })
      const leaseTimer = setInterval(() => {
        void this.renewLease(binding.id)
      }, LEASE_RENEW_INTERVAL_MS)
      const active: ActiveClient = {
        binding: leased,
        client,
        definition,
        expectedStop: false,
        fingerprint,
        leaseTimer,
        status: 'starting',
      }
      this.active.set(binding.id, active)
      await client.start()
      void client.done.then(
        () => this.handleClientExit(binding.id, new Error('Gateway client stopped unexpectedly')),
        (error) => this.handleClientExit(binding.id, error)
      )
      this.retry.delete(binding.id)
      this.loggedFailures.delete(binding.id)
      await this.reportStatus(binding.id, { status: 'online' })
    } catch (error) {
      if (client && !this.active.has(binding.id)) await client.stop().catch(() => undefined)
      if (!this.active.has(binding.id)) {
        if (this.statuses.get(binding.id) === 'needs_rebind') return
        const details = safeError(error)
        const retry = this.scheduleRetry(binding.id)
        this.logClientFailure(binding.id, details, retry)
        await this.reportStatus(binding.id, { ...details, status: 'degraded' })
        await this.bindingModel.releaseGatewayLease(binding.id, this.owner).catch(() => undefined)
        return
      }
      await this.handleClientExit(binding.id, error)
    }
  }

  private async renewLease(bindingId: string) {
    const renewed = await this.bindingModel.renewGatewayLease(bindingId, this.owner, LEASE_TTL_MS)
    if (!renewed) {
      await this.reportStatus(bindingId, {
        code: 'LEASE_LOST',
        message: 'Gateway binding lease was lost',
        status: 'degraded',
      })
      await this.stopClient(bindingId, true)
    }
  }

  private async handleClientExit(bindingId: string, error: unknown) {
    const active = this.active.get(bindingId)
    if (!active || active.expectedStop) return
    const details = safeError(error)
    const retry = this.scheduleRetry(bindingId)
    this.logClientFailure(bindingId, details, retry)
    await this.reportStatus(bindingId, { ...details, status: 'degraded' })
    await this.stopClient(bindingId, false)
  }

  private scheduleRetry(bindingId: string): RetrySchedule {
    const prior = this.retry.get(bindingId)?.attempt ?? 0
    const attempt = prior + 1
    const delay = Math.min(1000 * 2 ** Math.min(prior, 5), MAX_BACKOFF_MS)
    const state = { attempt, delayMs: delay, retryAt: this.now() + delay }
    this.retry.set(bindingId, state)
    return state
  }

  private logClientFailure(bindingId: string, details: { code: string; message: string }, retry: RetrySchedule) {
    const failureSignature = `${details.code}:${details.message}`
    if (this.loggedFailures.get(bindingId) === failureSignature) return
    this.loggedFailures.set(bindingId, failureSignature)
    log(
      'client failed binding=%s code=%s message=%s; retry scheduled attempt=%d delayMs=%d',
      bindingId,
      details.code,
      details.message,
      retry.attempt,
      retry.delayMs,
    )
  }

  private async reportStatus(bindingId: string, event: ChannelGatewayStatusEvent) {
    const active = this.active.get(bindingId)
    if (active) active.status = event.status
    this.statuses.set(bindingId, event.status)
    if (event.status === 'needs_rebind') {
      await this.bindingModel.markNeedsRebind(bindingId)
      await this.stopClient(bindingId, false)
      return
    }
    if (event.status === 'online') {
      await this.bindingModel.touchGatewayHeartbeat(bindingId)
      return
    }
    await this.bindingModel.updateGatewayStatus(
      bindingId,
      event.status,
      event.code || event.message ? { code: event.code || 'GATEWAY_ERROR', message: event.message || 'Gateway error' } : null
    )
  }

  private async stopClient(bindingId: string, expected: boolean) {
    const active = this.active.get(bindingId)
    if (!active) return
    active.expectedStop = true
    this.active.delete(bindingId)
    clearInterval(active.leaseTimer)
    await active.client.stop().catch((error) => log('client stop failed platform=%s: %O', active.definition.platform, error))
    await this.bindingModel.releaseGatewayLease(bindingId, this.owner).catch(() => undefined)
    if (expected && this.running) await this.bindingModel.updateGatewayStatus(bindingId, 'offline', null)
    if (expected) {
      this.retry.delete(bindingId)
      this.loggedFailures.delete(bindingId)
    }
  }

  async stop(): Promise<void> {
    if (!this.running && !this.startPromise) return
    this.running = false
    if (this.reconcileTimer) clearInterval(this.reconcileTimer)
    this.reconcileTimer = null
    this.abortController?.abort()
    this.abortController = null
    await Promise.all([...this.active.keys()].map((bindingId) => this.stopClient(bindingId, true)))
    await Promise.allSettled(this.workerTasks)
    this.workerTasks = []
    this.retry.clear()
    this.loggedFailures.clear()
    this.desiredCounts.clear()
    this.degradedCounts.clear()
    this.statuses.clear()
    this.waitingForDatabase = false
  }

  getSummary(enabled = true): ChannelGatewaySummary {
    if (!enabled) return { enabled: false, platforms: {}, running: false, status: 'disabled' }
    const platforms: Record<string, ChannelGatewayPlatformSummary> = {}
    for (const definition of this.definitions) {
      const active = [...this.active.values()].filter((item) => item.definition.platform === definition.platform)
      platforms[definition.platform] = {
        active: active.length,
        degraded:
          active.filter((item) => item.status === 'degraded').length + (this.degradedCounts.get(definition.platform) ?? 0),
        desired: this.desiredCounts.get(definition.platform) ?? 0,
        online: active.filter((item) => item.status === 'online').length,
        starting: active.filter((item) => item.status === 'starting').length,
      }
    }
    const degraded = Object.values(platforms).some((platform) => platform.degraded > 0 || platform.active < platform.desired)
    return {
      enabled: true,
      ...(this.coreError ? { error: this.coreError } : {}),
      platforms,
      running: this.running,
      status: resolveGatewaySummaryStatus({
        coreError: this.coreError,
        degraded,
        running: this.running,
        waitingForDatabase: this.waitingForDatabase,
      }),
    }
  }

  private recordCoreError(error: unknown) {
    this.coreError = safeError(error).message
    log('core error: %O', error)
  }
}
