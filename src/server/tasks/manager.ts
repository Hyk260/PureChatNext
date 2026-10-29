import { hostname } from 'node:os'
import debug from 'debug'
import { TaskQueueModel, TASK_MAX_ATTEMPTS } from '@pure/database/models/taskQueue'
import type { TaskRunItem } from '@pure/database/schemas/task'
import { abortableDelay, createNanoId } from '@pure/utils'

import { taskEnv } from '@/envs/tasks'
import { taskDeliveryFailure, deliverTask } from './deliver'
import { taskErrorSummary } from './errors'
import { executeTask } from './execute'
import { prepareTaskSnapshot, validateTaskModel } from './resources'

const log = debug('tasks:scheduler')
const SCHEDULER_KEY = Symbol.for('purechat.tasks.scheduler')
const POLL_MS = 15_000
const EXECUTION_TIMEOUT_MS = 5 * 60_000

export class TaskScheduler {
  private readonly owner = `tasks-${hostname()}-${process.pid}-${createNanoId(8)()}`
  private readonly controllers = new Map<string, AbortController>()
  private controller: AbortController | null = null
  private jobs: Promise<void>[] = []

  constructor(private readonly queue = new TaskQueueModel()) {}

  ensureRunning() {
    if (this.controller && !this.controller.signal.aborted) return
    this.controller = new AbortController()
    const signal = this.controller.signal
    this.jobs = [this.leaderLoop(signal), this.workerLoop(signal), this.workerLoop(signal), this.deliveryLoop(signal)]
  }

  async stop() {
    this.controller?.abort()
    for (const controller of this.controllers.values()) controller.abort()
    await Promise.allSettled(this.jobs)
    await this.queue.releaseLeader(this.owner)
    this.controller = null
  }

  abortRun(id: string) {
    this.controllers.get(id)?.abort()
  }

  private async pause(ms: number, signal: AbortSignal) {
    try {
      await abortableDelay(ms, signal)
    } catch {
      // 关闭调度器时结束等待，不将正常退出记录为失败。
    }
  }

  private async leaderLoop(signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        const leader = await this.queue.acquireLeader(this.owner)
        if (leader) {
          await this.queue.recover(this.owner)
          await this.queue.materialize(this.owner)
        } else {
          for (const controller of this.controllers.values()) controller.abort()
        }
      } catch {
        log('scheduler database unavailable; retrying')
      }
      await this.pause(POLL_MS, signal)
    }
  }

  private async workerLoop(signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        const run = await this.queue.claimRun(this.owner)
        if (run) {
          await this.run(run, signal)
          continue
        }
      } catch {
        log('task worker unavailable; retrying')
      }
      await this.pause(2_000, signal)
    }
  }

  private async run(run: TaskRunItem, parent: AbortSignal) {
    const controller = new AbortController()
    this.controllers.set(run.id, controller)
    const timeout = AbortSignal.timeout(EXECUTION_TIMEOUT_MS)
    const signal = AbortSignal.any([parent, controller.signal, timeout])
    const heartbeat = setInterval(() => {
      this.queue
        .renewRun(run.id, this.owner)
        .then((renewed) => {
          if (!renewed) controller.abort()
        })
        .catch(() => controller.abort())
    }, 5_000)
    try {
      if (!(await this.queue.isRunActive(run.id, this.owner))) return
      const snapshot = await prepareTaskSnapshot(run.userId, run.snapshot)
      const saved = await this.queue.saveSnapshot(run.id, this.owner, snapshot)
      if (!saved) return
      await validateTaskModel(run.userId, snapshot.provider, snapshot.model)
      const outcome = await executeTask(run.userId, snapshot, signal)
      await this.queue.finishRun(saved, this.owner, outcome)
    } catch (error) {
      if (parent.aborted || controller.signal.aborted) return
      const reason = taskErrorSummary(timeout.aborted ? new DOMException('timeout', 'TimeoutError') : error)
      if (reason.retryable && run.attempts < TASK_MAX_ATTEMPTS) {
        await this.queue.retryRun(run, this.owner, reason.message)
      } else {
        await this.queue.finishRun(run, this.owner, { error: reason.message, diagnostics: { code: reason.code } })
      }
      log('run failed id=%s code=%s', run.id, reason.code)
    } finally {
      clearInterval(heartbeat)
      this.controllers.delete(run.id)
    }
  }

  private async deliveryLoop(signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        const delivery = await this.queue.claimDelivery(this.owner)
        if (delivery) {
          const context = await this.queue.deliveryContext(delivery, this.owner)
          if (!context || context.task.status === 'canceled') {
            await this.queue.finishDelivery(delivery, this.owner, 'failed', '任务已取消，未继续推送')
          } else {
            try {
              await deliverTask(context.run, delivery, signal)
              await this.queue.finishDelivery(delivery, this.owner, 'accepted')
            } catch (error) {
              const failure = taskDeliveryFailure(error, delivery.platform)
              const status =
                failure.status === 'retry' && delivery.attempts >= TASK_MAX_ATTEMPTS ? 'failed' : failure.status
              await this.queue.finishDelivery(delivery, this.owner, status, failure.error)
            }
          }
        }
      } catch {
        log('delivery worker unavailable; retrying')
      }
      await this.pause(1_000, signal)
    }
  }
}

type SchedulerStore = typeof globalThis & { [SCHEDULER_KEY]?: TaskScheduler }

export function ensureTaskSchedulerRunning() {
  if (!taskEnv.TASK_SCHEDULER_ENABLED) return
  const store = globalThis as SchedulerStore
  store[SCHEDULER_KEY] ??= new TaskScheduler()
  store[SCHEDULER_KEY].ensureRunning()
}

export function abortTaskRun(id: string) {
  ;(globalThis as SchedulerStore)[SCHEDULER_KEY]?.abortRun(id)
}
