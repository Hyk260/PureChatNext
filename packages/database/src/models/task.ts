import { and, desc, eq, inArray, lt, notInArray, or } from 'drizzle-orm'
import type { TaskInput, TaskRunSnapshot, TaskStatus } from '@pure/types'
import { nextTaskRun } from '@pure/utils/taskSchedule'

import { getServerDB } from '../core/db-adaptor'
import { taskDeliveries, taskRuns, tasks, taskSchedulerState } from '../schemas/task'
import type { TaskItem } from '../schemas/task'
import type { ChatDatabase } from '../type'

export const OPEN_TASK_RUN_STATUSES = ['pending', 'running', 'retry'] as const
export const TERMINAL_TASK_STATUSES = ['completed', 'canceled'] as const

export function taskSnapshot(task: TaskInput): TaskRunSnapshot {
  return {
    agentId: task.agentId,
    channels: task.channels,
    enabled: task.enabled,
    instruction: task.instruction,
    model: task.model,
    priority: task.priority,
    provider: task.provider,
    schedule: task.schedule,
    title: task.title,
  }
}

export class TaskConflictError extends Error {}

export class TaskModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  list = (userId: string) => this.db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt))

  find = async (userId: string, id: string) => {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    return row ?? null
  }

  latestRuns = async (userId: string, taskIds: string[]) => {
    if (!taskIds.length) return []
    return this.db
      .selectDistinctOn([taskRuns.taskId])
      .from(taskRuns)
      .where(and(eq(taskRuns.userId, userId), inArray(taskRuns.taskId, taskIds)))
      .orderBy(taskRuns.taskId, desc(taskRuns.createdAt))
  }

  activeRuns = async (userId: string, taskIds: string[]) => {
    if (!taskIds.length) return []
    return this.db
      .select()
      .from(taskRuns)
      .where(
        and(
          eq(taskRuns.userId, userId),
          inArray(taskRuns.taskId, taskIds),
          inArray(taskRuns.status, [...OPEN_TASK_RUN_STATUSES])
        )
      )
      .orderBy(desc(taskRuns.createdAt))
  }

  findRun = async (userId: string, taskId: string, id: string) => {
    const [run] = await this.db
      .select()
      .from(taskRuns)
      .where(and(eq(taskRuns.id, id), eq(taskRuns.userId, userId), eq(taskRuns.taskId, taskId)))
    return run ?? null
  }

  findDeliveryPlatform = async (userId: string, taskId: string, deliveryId: string) => {
    const [row] = await this.db
      .select({ platform: taskDeliveries.platform })
      .from(taskDeliveries)
      .innerJoin(taskRuns, eq(taskRuns.id, taskDeliveries.runId))
      .innerJoin(tasks, eq(tasks.id, taskRuns.taskId))
      .where(and(eq(taskDeliveries.id, deliveryId), eq(taskDeliveries.userId, userId), eq(tasks.id, taskId)))
    return row?.platform ?? null
  }

  runs = async (userId: string, taskId: string, limit = 50, before?: string) => {
    const [cursor] = before
      ? await this.db
          .select({ createdAt: taskRuns.createdAt, id: taskRuns.id })
          .from(taskRuns)
          .where(and(eq(taskRuns.id, before), eq(taskRuns.userId, userId), eq(taskRuns.taskId, taskId)))
      : []
    if (before && !cursor) return []
    return this.db
      .select()
      .from(taskRuns)
      .where(
        and(
          eq(taskRuns.userId, userId),
          eq(taskRuns.taskId, taskId),
          cursor
            ? or(
                lt(taskRuns.createdAt, cursor.createdAt),
                and(eq(taskRuns.createdAt, cursor.createdAt), lt(taskRuns.id, cursor.id))
              )
            : undefined
        )
      )
      .orderBy(desc(taskRuns.createdAt), desc(taskRuns.id))
      .limit(limit)
  }

  deliveries = (userId: string, runIds: string[]) => {
    if (!runIds.length) return Promise.resolve([])
    return this.db
      .select()
      .from(taskDeliveries)
      .where(and(eq(taskDeliveries.userId, userId), inArray(taskDeliveries.runId, runIds)))
  }

  create = async (userId: string, input: TaskInput, now = new Date()) => {
    const [task] = await this.db
      .insert(tasks)
      .values({
        ...input,
        userId,
        nextRunAt: input.enabled ? nextTaskRun(input.schedule, now) : null,
      })
      .returning()
    return task!
  }

  update = async (userId: string, id: string, input: TaskInput, status?: TaskStatus, now = new Date()) => {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .for('update')
      if (!current) return null
      const nextStatus = status ?? current.status
      const terminal = nextStatus === 'completed' || nextStatus === 'canceled'
      const enabled = input.enabled && !terminal
      const scheduleChanged = JSON.stringify(current.schedule) !== JSON.stringify(input.schedule)
      const shouldRecompute = enabled && (!current.enabled || scheduleChanged || !current.nextRunAt)
      const nextRunAt = shouldRecompute ? nextTaskRun(input.schedule, now) : current.nextRunAt
      const [updated] = await tx
        .update(tasks)
        .set({
          ...input,
          enabled,
          nextRunAt: enabled ? nextRunAt : null,
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(tasks.id, id))
        .returning()
      if (terminal) {
        await tx
          .update(taskRuns)
          .set({
            status: 'canceled',
            error: '任务已停止',
            completedAt: now,
            leaseExpiresAt: null,
            leaseOwner: null,
            updatedAt: now,
          })
          .where(and(eq(taskRuns.taskId, id), inArray(taskRuns.status, [...OPEN_TASK_RUN_STATUSES])))
      }
      if (nextStatus === 'canceled') {
        const runs = tx.select({ id: taskRuns.id }).from(taskRuns).where(eq(taskRuns.taskId, id))
        await tx
          .update(taskDeliveries)
          .set({
            status: 'failed',
            error: '任务已取消，未继续推送',
            completedAt: now,
            updatedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          })
          .where(and(inArray(taskDeliveries.runId, runs), inArray(taskDeliveries.status, ['pending', 'retry'])))
      }
      return updated!
    })
  }

  enqueueManual = async (userId: string, taskId: string, requestId: string, now = new Date()) => {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
        .for('update')
      if (!task) return null
      if (task.status === 'completed' || task.status === 'canceled') {
        throw new TaskConflictError('请先将任务恢复为待办，再运行')
      }
      const dedupeKey = `manual:${taskId}:${requestId}`
      const [existing] = await tx.select().from(taskRuns).where(eq(taskRuns.dedupeKey, dedupeKey))
      if (existing) return existing
      const [active] = await tx
        .select()
        .from(taskRuns)
        .where(and(eq(taskRuns.taskId, taskId), inArray(taskRuns.status, [...OPEN_TASK_RUN_STATUSES])))
        .limit(1)
      if (active) return active
      const [run] = await tx
        .insert(taskRuns)
        .values({
          dedupeKey,
          priority: task.priority,
          scheduledAt: now,
          snapshot: taskSnapshot(task),
          source: 'manual',
          taskId,
          userId,
        })
        .returning()
      return run!
    })
  }

  stopRun = async (userId: string, taskId: string, runId: string) => {
    const now = new Date()
    const [row] = await this.db
      .update(taskRuns)
      .set({
        status: 'canceled',
        error: '用户停止了本次运行',
        completedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(taskRuns.id, runId),
          eq(taskRuns.userId, userId),
          eq(taskRuns.taskId, taskId),
          inArray(taskRuns.status, [...OPEN_TASK_RUN_STATUSES])
        )
      )
      .returning()
    return row ?? null
  }

  deleteRun = async (userId: string, taskId: string, runId: string) => {
    const [row] = await this.db
      .delete(taskRuns)
      .where(
        and(
          eq(taskRuns.id, runId),
          eq(taskRuns.userId, userId),
          eq(taskRuns.taskId, taskId),
          notInArray(taskRuns.status, [...OPEN_TASK_RUN_STATUSES])
        )
      )
      .returning({ id: taskRuns.id })
    return row ?? null
  }

  retryDelivery = async (userId: string, taskId: string, deliveryId: string) => {
    return this.db.transaction(async (tx) => {
      const [delivery] = await tx
        .select({ delivery: taskDeliveries, task: tasks })
        .from(taskDeliveries)
        .innerJoin(taskRuns, eq(taskRuns.id, taskDeliveries.runId))
        .innerJoin(tasks, eq(tasks.id, taskRuns.taskId))
        .where(and(eq(taskDeliveries.id, deliveryId), eq(taskDeliveries.userId, userId), eq(tasks.id, taskId)))
        .for('update', { of: taskDeliveries })
      if (!delivery) return null
      if (delivery.task.status === 'canceled') throw new TaskConflictError('任务已取消，请先恢复任务')
      if (delivery.delivery.status === 'sending') throw new TaskConflictError('该渠道正在推送，请稍后再试')
      const [updated] = await tx
        .update(taskDeliveries)
        .set({
          status: 'pending',
          attempts: 0,
          availableAt: new Date(),
          completedAt: null,
          error: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(taskDeliveries.id, deliveryId))
        .returning()
      return updated!
    })
  }

  schedulerState = async () => {
    const [row] = await this.db.select().from(taskSchedulerState).where(eq(taskSchedulerState.id, 'primary'))
    return row ?? null
  }
}

export type { TaskItem }
