import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import type {
  TaskChannel,
  TaskDeliveryStatus,
  TaskPriority,
  TaskRunSnapshot,
  TaskRunStatus,
  TaskSchedule,
  TaskStatus,
} from '@pure/types'

import { idGenerator } from '../utils/idGenerator'
import { createdAt, timestamptz, updatedAt } from './_helpers'
import { users } from './user'

export const tasks = pgTable(
  'tasks',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('tasks'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    instruction: text('instruction').notNull(),
    agentId: text('agent_id').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    priority: integer('priority').$type<TaskPriority>().notNull().default(0),
    status: text('status').$type<TaskStatus>().notNull().default('todo'),
    enabled: boolean('enabled').notNull().default(true),
    schedule: jsonb('schedule').$type<TaskSchedule>().notNull(),
    channels: jsonb('channels').$type<TaskChannel[]>().notNull().default([]),
    nextRunAt: timestamptz('next_run_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('tasks_owner_idx').on(t.userId, t.createdAt),
    index('tasks_due_idx')
      .on(t.nextRunAt)
      .where(sql`${t.enabled} = true`),
    check('tasks_priority_check', sql`${t.priority} between 0 and 4`),
    check('tasks_status_check', sql`${t.status} in ('todo', 'review', 'completed', 'canceled')`),
  ]
)

export const taskRuns = pgTable(
  'task_runs',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('taskRuns'))
      .primaryKey(),
    taskId: text('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    source: text('source').$type<'manual' | 'schedule'>().notNull(),
    status: text('status').$type<TaskRunStatus>().notNull().default('pending'),
    priority: integer('priority').notNull().default(0),
    snapshot: jsonb('snapshot').$type<TaskRunSnapshot>().notNull(),
    scheduledAt: timestamptz('scheduled_at').notNull(),
    availableAt: timestamptz('available_at').notNull().defaultNow(),
    startedAt: timestamptz('started_at'),
    completedAt: timestamptz('completed_at'),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    attempts: integer('attempts').notNull().default(0),
    result: text('result'),
    error: text('error'),
    diagnostics: jsonb('diagnostics').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('task_runs_dedupe_idx').on(t.dedupeKey),
    uniqueIndex('task_runs_user_running_idx')
      .on(t.userId)
      .where(sql`${t.status} = 'running'`),
    index('task_runs_queue_idx').on(t.status, t.availableAt, t.leaseExpiresAt),
    index('task_runs_history_idx').on(t.taskId, t.createdAt),
    check(
      'task_runs_status_check',
      sql`${t.status} in ('pending', 'running', 'retry', 'succeeded', 'failed', 'canceled', 'skipped')`
    ),
  ]
)

export const taskDeliveries = pgTable(
  'task_deliveries',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('taskDeliveries'))
      .primaryKey(),
    runId: text('run_id')
      .references(() => taskRuns.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    platform: text('platform').$type<TaskChannel>().notNull(),
    status: text('status').$type<TaskDeliveryStatus>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamptz('available_at').notNull().defaultNow(),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    error: text('error'),
    completedAt: timestamptz('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('task_deliveries_run_platform_idx').on(t.runId, t.platform),
    index('task_deliveries_queue_idx').on(t.status, t.availableAt),
  ]
)

/** 跨实例的调度领导租约，同时提供数据库级运行心跳。 */
export const taskSchedulerState = pgTable('task_scheduler_state', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  leaseExpiresAt: timestamptz('lease_expires_at').notNull(),
  heartbeatAt: timestamptz('heartbeat_at').notNull(),
})

export type TaskItem = typeof tasks.$inferSelect
export type TaskRunItem = typeof taskRuns.$inferSelect
export type TaskDeliveryItem = typeof taskDeliveries.$inferSelect
