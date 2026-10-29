import { and, asc, eq, gt, inArray, lt, lte, or, sql } from 'drizzle-orm'
import type { TaskDeliveryStatus, TaskRunSnapshot } from '@pure/types'
import { taskFiring } from '@pure/utils/taskSchedule'

import { getServerDB } from '../core/db-adaptor'
import { taskDeliveries, taskRuns, tasks, taskSchedulerState } from '../schemas/task'
import type { TaskDeliveryItem, TaskItem, TaskRunItem } from '../schemas/task'
import type { ChatDatabase, Transaction } from '../type'
import { OPEN_TASK_RUN_STATUSES, taskSnapshot } from './task'

export const TASK_LEASE_MS = 90_000
export const TASK_MAX_ATTEMPTS = 3
const OPEN_DELIVERY_STATUSES = ['pending', 'retry'] as const

const leaderCondition = (owner: string, now: Date) => sql`exists (
  select 1 from task_scheduler_state where id = 'primary' and owner = ${owner} and lease_expires_at > ${now.toISOString()}
)`

const runningLease = (runId: string, owner: string, now: Date) =>
  and(
    eq(taskRuns.id, runId),
    eq(taskRuns.status, 'running'),
    eq(taskRuns.leaseOwner, owner),
    gt(taskRuns.leaseExpiresAt, now),
    leaderCondition(owner, now)
  )

async function addDeliveries(tx: Transaction, run: TaskRunItem) {
  if (!run.snapshot.channels.length) return
  await tx
    .insert(taskDeliveries)
    .values(
      run.snapshot.channels.map((platform) => ({
        platform,
        runId: run.id,
        userId: run.userId,
      }))
    )
    .onConflictDoNothing({ target: [taskDeliveries.runId, taskDeliveries.platform] })
}

function scheduledValues(task: TaskItem, at: Date, status: 'pending' | 'skipped', error?: string) {
  return {
    dedupeKey: `schedule:${task.id}:${at.toISOString()}`,
    error,
    completedAt: status === 'skipped' ? new Date() : null,
    priority: task.priority,
    scheduledAt: at,
    snapshot: taskSnapshot(task),
    source: 'schedule' as const,
    status,
    taskId: task.id,
    userId: task.userId,
  }
}

export class TaskQueueModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  acquireLeader = async (owner: string, now = new Date()) => {
    const [row] = await this.db
      .insert(taskSchedulerState)
      .values({
        heartbeatAt: now,
        id: 'primary',
        leaseExpiresAt: new Date(now.getTime() + TASK_LEASE_MS),
        owner,
      })
      .onConflictDoUpdate({
        target: taskSchedulerState.id,
        set: { heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + TASK_LEASE_MS), owner },
        setWhere: or(eq(taskSchedulerState.owner, owner), lte(taskSchedulerState.leaseExpiresAt, now)),
      })
      .returning()
    return Boolean(row)
  }

  releaseLeader = async (owner: string) => {
    await this.db
      .update(taskSchedulerState)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(taskSchedulerState.owner, owner))
  }

  materialize = async (owner: string, now = new Date()) => {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.enabled, true),
            inArray(tasks.status, ['todo', 'review']),
            lte(tasks.nextRunAt, now),
            leaderCondition(owner, now)
          )
        )
        .orderBy(asc(tasks.nextRunAt))
        .limit(100)
        .for('update', { skipLocked: true })
      for (const task of due) {
        const firing = taskFiring(task.schedule, task.nextRunAt!, now)
        if (!firing) continue
        if (firing.missedFrom) {
          await tx
            .insert(taskRuns)
            .values({
              ...scheduledValues(task, firing.missedFrom, 'skipped', '停机期间较早的排期已跳过'),
              diagnostics: { missedUntil: firing.scheduledAt.toISOString() },
            })
            .onConflictDoNothing()
        }
        const [open] = await tx
          .select({ id: taskRuns.id })
          .from(taskRuns)
          .where(and(eq(taskRuns.taskId, task.id), inArray(taskRuns.status, [...OPEN_TASK_RUN_STATUSES])))
          .limit(1)
        const skipped = firing.skipped || Boolean(open)
        const reason = open ? '前一次任务尚未结束，本次排期已跳过' : '超过 15 分钟补跑窗口，已跳过'
        await tx
          .insert(taskRuns)
          .values(
            scheduledValues(task, firing.scheduledAt, skipped ? 'skipped' : 'pending', skipped ? reason : undefined)
          )
          .onConflictDoNothing()
        await tx.update(tasks).set({ nextRunAt: firing.nextRunAt, updatedAt: now }).where(eq(tasks.id, task.id))
      }
      return due.length
    })
  }

  recover = async (owner: string, now = new Date()) => {
    await this.db.transaction(async (tx) => {
      const stale = await tx
        .select()
        .from(taskRuns)
        .where(and(eq(taskRuns.status, 'running'), lt(taskRuns.leaseExpiresAt, now), leaderCondition(owner, now)))
        .limit(50)
        .for('update', { skipLocked: true })
      for (const run of stale) {
        const failed = run.attempts >= TASK_MAX_ATTEMPTS
        const [updated] = await tx
          .update(taskRuns)
          .set({
            availableAt: now,
            completedAt: failed ? now : null,
            error: failed ? '执行服务多次中断，请检查运行日志' : '执行服务中断，等待恢复运行',
            leaseExpiresAt: null,
            leaseOwner: null,
            status: failed ? 'failed' : 'retry',
            updatedAt: now,
          })
          .where(eq(taskRuns.id, run.id))
          .returning()
        if (failed) await addDeliveries(tx, updated!)
      }
      // 出站调用没有统一的送达回执。进程中断后保留不确定状态，避免盲目重复通知。
      await tx
        .update(taskDeliveries)
        .set({
          completedAt: now,
          error: '推送期间服务中断，无法确认平台是否接受，请核实后重新推送',
          leaseExpiresAt: null,
          leaseOwner: null,
          status: 'unknown',
          updatedAt: now,
        })
        .where(
          and(eq(taskDeliveries.status, 'sending'), lt(taskDeliveries.leaseExpiresAt, now), leaderCondition(owner, now))
        )
    })
  }

  claimRun = async (owner: string, now = new Date()): Promise<TaskRunItem | null> => {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(taskRuns)
        .where(
          and(
            inArray(taskRuns.status, ['pending', 'retry']),
            lte(taskRuns.availableAt, now),
            leaderCondition(owner, now),
            sql`not exists (select 1 from task_runs active where active.user_id = ${taskRuns.userId} and active.status = 'running')`
          )
        )
        .orderBy(
          sql`case when ${taskRuns.priority} = 0 then 5 else ${taskRuns.priority} end`,
          asc(taskRuns.scheduledAt)
        )
        .limit(1)
        .for('update', { skipLocked: true })
      if (!candidate) return null
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`task-user:${candidate.userId}`}, 0))`)
      const [active] = await tx
        .select({ id: taskRuns.id })
        .from(taskRuns)
        .where(and(eq(taskRuns.userId, candidate.userId), eq(taskRuns.status, 'running')))
        .limit(1)
      if (active) return null
      const [row] = await tx
        .update(taskRuns)
        .set({
          attempts: candidate.attempts + 1,
          error: null,
          leaseExpiresAt: new Date(now.getTime() + TASK_LEASE_MS),
          leaseOwner: owner,
          startedAt: candidate.startedAt ?? now,
          status: 'running',
          updatedAt: now,
        })
        .where(eq(taskRuns.id, candidate.id))
        .returning()
      return row ?? null
    })
  }

  renewRun = async (id: string, owner: string, now = new Date()) => {
    const [row] = await this.db
      .update(taskRuns)
      .set({ leaseExpiresAt: new Date(now.getTime() + TASK_LEASE_MS) })
      .where(runningLease(id, owner, now))
      .returning({ id: taskRuns.id })
    return Boolean(row)
  }

  isRunActive = async (id: string, owner: string, now = new Date()) => {
    const [run] = await this.db
      .select({ id: taskRuns.id })
      .from(taskRuns)
      .where(runningLease(id, owner, now))
    return Boolean(run)
  }

  saveSnapshot = async (id: string, owner: string, snapshot: TaskRunSnapshot) => {
    const [run] = await this.db
      .update(taskRuns)
      .set({ snapshot })
      .where(runningLease(id, owner, new Date()))
      .returning()
    return run ?? null
  }

  finishRun = async (
    run: TaskRunItem,
    owner: string,
    outcome: {
      diagnostics?: Record<string, unknown>
      error?: string
      result?: string
    },
    now = new Date()
  ) => {
    return this.db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, run.taskId)).for('update')
      if (!task || task.status === 'completed' || task.status === 'canceled') return null
      const [updated] = await tx
        .update(taskRuns)
        .set({
          completedAt: now,
          diagnostics: outcome.diagnostics,
          error: outcome.error ?? null,
          leaseExpiresAt: null,
          leaseOwner: null,
          result: outcome.result ?? null,
          status: outcome.error ? 'failed' : 'succeeded',
          updatedAt: now,
        })
        .where(runningLease(run.id, owner, now))
        .returning()
      if (!updated) return null
      if (!outcome.error) await tx.update(tasks).set({ status: 'review', updatedAt: now }).where(eq(tasks.id, task.id))
      await addDeliveries(tx, updated)
      return updated
    })
  }

  retryRun = async (run: TaskRunItem, owner: string, error: string, now = new Date()) => {
    const [updated] = await this.db
      .update(taskRuns)
      .set({
        availableAt: new Date(now.getTime() + 10_000 * 2 ** (run.attempts - 1)),
        error,
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'retry',
        updatedAt: now,
      })
      .where(runningLease(run.id, owner, now))
      .returning()
    return updated ?? null
  }

  claimDelivery = async (owner: string, now = new Date()) => {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(taskDeliveries)
        .where(
          and(
            inArray(taskDeliveries.status, [...OPEN_DELIVERY_STATUSES]),
            lte(taskDeliveries.availableAt, now),
            leaderCondition(owner, now),
            sql`not exists (select 1 from task_deliveries recent where recent.user_id = ${taskDeliveries.userId}
          and recent.platform = ${taskDeliveries.platform} and (recent.status = 'sending'
          or recent.completed_at > ${new Date(now.getTime() - 4_000).toISOString()}))`
          )
        )
        .orderBy(asc(taskDeliveries.availableAt))
        .limit(1)
        .for('update', { skipLocked: true })
      if (!candidate) return null
      const [delivery] = await tx
        .update(taskDeliveries)
        .set({
          attempts: candidate.attempts + 1,
          leaseOwner: owner,
          leaseExpiresAt: new Date(now.getTime() + TASK_LEASE_MS),
          status: 'sending',
          updatedAt: now,
        })
        .where(eq(taskDeliveries.id, candidate.id))
        .returning()
      return delivery ?? null
    })
  }

  deliveryContext = async (delivery: TaskDeliveryItem, owner: string) => {
    const now = new Date()
    const [context] = await this.db
      .select({ run: taskRuns, task: tasks })
      .from(taskRuns)
      .innerJoin(tasks, eq(tasks.id, taskRuns.taskId))
      .innerJoin(taskDeliveries, eq(taskDeliveries.runId, taskRuns.id))
      .where(
        and(
          eq(taskDeliveries.id, delivery.id),
          eq(taskDeliveries.leaseOwner, owner),
          eq(taskDeliveries.status, 'sending'),
          gt(taskDeliveries.leaseExpiresAt, now),
          leaderCondition(owner, now)
        )
      )
    return context ?? null
  }

  finishDelivery = async (
    delivery: TaskDeliveryItem,
    owner: string,
    status: TaskDeliveryStatus,
    error: string | null = null,
    now = new Date()
  ) => {
    const retry = status === 'retry'
    const [row] = await this.db
      .update(taskDeliveries)
      .set({
        availableAt: retry ? new Date(now.getTime() + 10_000 * 2 ** (delivery.attempts - 1)) : delivery.availableAt,
        completedAt: retry ? null : now,
        error,
        leaseOwner: null,
        leaseExpiresAt: null,
        status,
        updatedAt: now,
      })
      .where(
        and(
          eq(taskDeliveries.id, delivery.id),
          eq(taskDeliveries.leaseOwner, owner),
          eq(taskDeliveries.status, 'sending'),
          gt(taskDeliveries.leaseExpiresAt, now),
          leaderCondition(owner, now)
        )
      )
      .returning()
    return row ?? null
  }
}
