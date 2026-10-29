import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskInput } from '@pure/types'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { TaskModel } from '../task'
import { TaskQueueModel } from '../taskQueue'
import * as schema from '../../schemas'

config({ path: resolve(import.meta.dirname, '../../../../../.env.local'), quiet: true })
const databaseUrl = process.env.DATABASE_URL
const isLocal = databaseUrl && new Set(['localhost', '127.0.0.1', '[::1]', '::1']).has(new URL(databaseUrl).hostname)

describe.skipIf(!isLocal)('persistent task execution and delivery queue', () => {
  const namespace = `tasks_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(databaseUrl!, { max: 1 })
  const client = postgres(databaseUrl!, { connection: { search_path: namespace }, max: 8 })
  const db = drizzle(client, { schema })
  const model = new TaskModel(db)
  const queue = new TaskQueueModel(db)
  const userId = randomUUID()
  const otherId = randomUUID()
  const owner = 'test-worker'
  const input: TaskInput = {
    agentId: 'agt_inbox',
    channels: ['qq', 'wechat'],
    enabled: true,
    instruction: '喝水',
    model: 'test',
    priority: 0,
    provider: 'openai',
    schedule: { frequency: 'hourly', minute: 0, timezone: 'UTC' },
    title: '喝水提醒',
  }

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    await admin.unsafe(`CREATE TABLE "${namespace}"."users" (LIKE public.users INCLUDING ALL)`)
    const migration = readFileSync(
      resolve(import.meta.dirname, '../../migrations/0040_wooden_smiling_tiger.sql'),
      'utf8'
    )
    await client.unsafe(migration.replaceAll('"public".', `"${namespace}".`))
    await db.insert(schema.users).values([userId, otherId].map((id) => ({ id, userId: id.replaceAll('-', '') })))
  })
  beforeEach(async () => {
    await db.delete(schema.tasks)
    await db.delete(schema.taskSchedulerState)
    await queue.acquireLeader(owner)
  })
  afterAll(async () => {
    await client.end()
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`)
    await admin.end()
  })

  it('isolates owners and makes manual double clicks idempotent', async () => {
    const task = await model.create(userId, input)
    expect(await model.find(otherId, task.id)).toBeNull()
    expect(await model.enqueueManual(otherId, task.id, randomUUID())).toBeNull()
    const requestId = randomUUID()
    const runs = await Promise.all(Array.from({ length: 4 }, () => model.enqueueManual(userId, task.id, requestId)))
    expect(new Set(runs.map((run) => run?.id)).size).toBe(1)
    expect(await model.runs(otherId, task.id)).toHaveLength(0)
    expect(await model.runs(userId, task.id)).toHaveLength(1)
  })

  it('only has one leader and one run per scheduled timestamp under concurrent ticks', async () => {
    expect(await queue.acquireLeader('other-worker')).toBe(false)
    const now = new Date()
    const schedule = { frequency: 'hourly' as const, minute: now.getUTCMinutes(), timezone: 'UTC' }
    const task = await model.create(userId, { ...input, schedule })
    const due = new Date(now)
    due.setUTCSeconds(0, 0)
    await db.update(schema.tasks).set({ nextRunAt: due }).where(eq(schema.tasks.id, task.id))
    await Promise.all([queue.materialize(owner, now), queue.materialize(owner, now)])
    expect(await model.runs(userId, task.id)).toHaveLength(1)
    expect((await model.find(userId, task.id))!.nextRunAt!.getTime()).toBeGreaterThan(now.getTime())
  })

  it('orders priority without overlapping a user, while another user can run', async () => {
    const low = await model.create(userId, { ...input, priority: 4 })
    const urgent = await model.create(userId, { ...input, priority: 1 })
    const other = await model.create(otherId, input)
    await model.enqueueManual(userId, low.id, randomUUID())
    await model.enqueueManual(userId, urgent.id, randomUUID())
    expect((await queue.claimRun(owner))?.taskId).toBe(urgent.id)
    expect(await queue.claimRun(owner)).toBeNull()
    await model.enqueueManual(otherId, other.id, randomUUID())
    expect((await queue.claimRun(owner))?.taskId).toBe(other.id)
  })

  it('does not start two runs for the same user under concurrent claims', async () => {
    const firstTask = await model.create(userId, input)
    const secondTask = await model.create(userId, input)
    await model.enqueueManual(userId, firstTask.id, randomUUID())
    await model.enqueueManual(userId, secondTask.id, randomUUID())

    const claims = await Promise.all([queue.claimRun(owner), queue.claimRun(owner)])

    expect(claims.filter(Boolean)).toHaveLength(1)
  })

  it('persists the result before independent channel delivery and keeps the schedule active', async () => {
    const task = await model.create(userId, input)
    await model.enqueueManual(userId, task.id, randomUUID())
    const run = (await queue.claimRun(owner))!
    await queue.finishRun(run, owner, { result: '喝杯水吧', diagnostics: { tools: ['getWeather'] } })
    expect(await queue.finishRun(run, owner, { result: '重复结果' })).toBeNull()
    const updated = (await model.find(userId, task.id))!
    expect(updated.status).toBe('review')
    expect(updated.enabled).toBe(true)
    const deliveries = await model.deliveries(userId, [run.id])
    expect(deliveries).toHaveLength(2)
    const delivery = (await queue.claimDelivery(owner))!
    expect((await queue.deliveryContext(delivery, owner))?.run.result).toBe('喝杯水吧')
    await queue.finishDelivery(delivery, owner, 'accepted')
    expect(await model.retryDelivery(otherId, task.id, delivery.id)).toBeNull()
    await model.retryDelivery(userId, task.id, delivery.id)
    expect((await model.runs(userId, task.id))[0]?.result).toBe('喝杯水吧')
    expect(await model.runs(userId, task.id)).toHaveLength(1)
  })

  it('restores expired execution leases and rejects writes from stale workers', async () => {
    const task = await model.create(userId, input)
    await model.enqueueManual(userId, task.id, randomUUID())
    const run = (await queue.claimRun(owner))!
    await db
      .update(schema.taskRuns)
      .set({ leaseExpiresAt: new Date(Date.now() - 1) })
      .where(eq(schema.taskRuns.id, run.id))
    await queue.recover(owner)
    expect((await model.runs(userId, task.id))[0]?.status).toBe('retry')
    expect(await queue.finishRun(run, 'stale-owner', { result: '不应保存' })).toBeNull()
    expect((await queue.claimRun(owner))?.attempts).toBe(2)
  })

  it('cancels unfinished runs and never publishes their late results', async () => {
    const task = await model.create(userId, input)
    await model.enqueueManual(userId, task.id, randomUUID())
    const run = (await queue.claimRun(owner))!
    await model.update(userId, task.id, input, 'canceled')
    expect(await queue.renewRun(run.id, owner)).toBe(false)
    expect(await queue.finishRun(run, owner, { result: '迟到结果' })).toBeNull()
    expect(await model.deliveries(userId, [run.id])).toHaveLength(0)
    expect((await model.find(userId, task.id))?.nextRunAt).toBeNull()
  })

  it('preserves the current business status when only task configuration changes', async () => {
    const task = await model.create(userId, input)
    await db.update(schema.tasks).set({ status: 'review' }).where(eq(schema.tasks.id, task.id))

    await model.update(userId, task.id, { ...input, priority: 3 })

    expect((await model.find(userId, task.id))?.status).toBe('review')
  })

  it('finds the owner-scoped channel for legacy notification retry checks', async () => {
    const task = await model.create(userId, { ...input, channels: [] })
    const run = await model.enqueueManual(userId, task.id, 'delivery-policy')
    const [delivery] = await db
      .insert(schema.taskDeliveries)
      .values({ platform: 'qq', runId: run!.id, userId })
      .returning()

    expect(await model.findDeliveryPlatform(userId, task.id, delivery!.id)).toBe('qq')
    expect(await model.findDeliveryPlatform(otherId, task.id, delivery!.id)).toBeNull()
  })

  it('paginates history by a stable cursor when runs share a timestamp', async () => {
    const task = await model.create(userId, input)
    const createdAt = new Date()
    await db.insert(schema.taskRuns).values(
      Array.from({ length: 55 }, (_, index) => ({
        createdAt,
        dedupeKey: `history:${task.id}:${index}`,
        priority: input.priority,
        scheduledAt: createdAt,
        snapshot: { ...input },
        source: 'manual' as const,
        taskId: task.id,
        userId,
      }))
    )

    const firstPage = await model.runs(userId, task.id, 50)
    const secondPage = await model.runs(userId, task.id, 50, firstPage.at(-1)!.id)

    expect(firstPage).toHaveLength(50)
    expect(secondPage).toHaveLength(5)
    expect(new Set([...firstPage, ...secondPage].map((run) => run.id)).size).toBe(55)
  })

  it('aggregates missed periods and only catches up the most recent occurrence', async () => {
    const now = new Date()
    const task = await model.create(userId, {
      ...input,
      schedule: {
        frequency: 'hourly',
        minute: now.getUTCMinutes(),
        timezone: 'UTC',
      },
    })
    await db
      .update(schema.tasks)
      .set({ nextRunAt: new Date(now.getTime() - 3_600_000 * 5) })
      .where(eq(schema.tasks.id, task.id))
    await queue.materialize(owner, now)
    const runs = await model.runs(userId, task.id)
    expect(runs).toHaveLength(2)
    expect(runs.filter((run) => run.status === 'pending')).toHaveLength(1)
    expect(runs.filter((run) => run.status === 'skipped')).toHaveLength(1)
  })

  it('leaves an interrupted outbound request uncertain instead of sending it twice', async () => {
    const task = await model.create(userId, input)
    await model.enqueueManual(userId, task.id, randomUUID())
    const run = (await queue.claimRun(owner))!
    await queue.finishRun(run, owner, { result: '完成' })
    const delivery = (await queue.claimDelivery(owner))!
    await db
      .update(schema.taskDeliveries)
      .set({ leaseExpiresAt: new Date(Date.now() - 1) })
      .where(eq(schema.taskDeliveries.id, delivery.id))
    await queue.recover(owner)
    const [saved] = await db
      .select()
      .from(schema.taskDeliveries)
      .where(and(eq(schema.taskDeliveries.id, delivery.id), eq(schema.taskDeliveries.userId, userId)))
    expect(saved?.status).toBe('unknown')
    expect(await queue.finishDelivery(delivery, owner, 'accepted')).toBeNull()
  })
})
