import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CHANNEL_LOG_RETENTION_MS } from '@pure/types'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { ChannelGatewayLogModel } from '../channelGatewayLog'
import * as schema from '../../schemas'

config({ path: resolve(import.meta.dirname, '../../../../../.env.local'), quiet: true })
const databaseUrl = process.env.DATABASE_URL
const isLocal = databaseUrl && new Set(['localhost', '127.0.0.1', '::1']).has(new URL(databaseUrl).hostname)

describe.skipIf(!isLocal)('channel diagnostic PostgreSQL isolation and retention', () => {
  const namespace = `channel_logs_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(databaseUrl!, { max: 1 })
  const client = postgres(databaseUrl!, { connection: { search_path: namespace }, max: 8 })
  const db = drizzle(client, { schema })
  const model = new ChannelGatewayLogModel(db)
  const userId = randomUUID()
  const otherUser = randomUUID()
  const now = new Date()
  const count = async () => db.select().from(schema.channelGatewayLogs).where(and(
    eq(schema.channelGatewayLogs.userId, userId), eq(schema.channelGatewayLogs.platform, 'qq'),
  ))

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    await admin.unsafe(`CREATE TABLE "${namespace}"."users" (LIKE public.users INCLUDING ALL)`)
    const migration = readFileSync(resolve(import.meta.dirname, '../../migrations/0033_goofy_deathstrike.sql'), 'utf8')
    await client.unsafe(migration.replaceAll('"public"."users"', `"${namespace}"."users"`))
    await db.insert(schema.users).values([userId, otherUser].map((id) => ({ id, userId: id.replaceAll('-', '') })))
  })
  afterAll(async () => {
    await client.end()
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`)
    await admin.end()
  })

  it('keeps user and platform scopes separate and serializes concurrent clipping to 200', async () => {
    await model.append({ userId: otherUser, platform: 'qq', event: 'send_failed', code: 'ECONNRESET' }, now)
    await model.append({ userId, platform: 'wechat', event: 'needs_rebind' }, now)
    await Promise.all(Array.from({ length: 220 }, (_, index) => model.append({
      userId, platform: 'qq', event: 'bound', bindingId: `old-binding-${index}`,
    }, new Date(now.getTime() + index))))
    expect(await count()).toHaveLength(200)
    expect((await model.read(userId, 'qq', now)).text).not.toMatch(/send_failed|needs_rebind/)
    expect((await model.read(otherUser, 'qq', now)).text).toContain('send_failed')
    expect((await model.read(userId, 'wechat', now)).text).toContain('needs_rebind')
    expect((await model.read(userId, 'qq', now)).truncated).toBe(true)
  })

  it('suppresses repeated errors across retry events, but records recovery and a later recurrence', async () => {
    const input = { userId: otherUser, platform: 'wechat' as const, bindingId: 'deleted-binding', event: 'offline' as const, code: 'ECONNRESET' }
    await Promise.all(Array.from({ length: 6 }, () => model.append(input, now)))
    await model.append({ ...input, event: 'retry' }, new Date(now.getTime() + 10))
    await model.append(input, new Date(now.getTime() + 20))
    expect((await model.read(otherUser, 'wechat', now)).text.match(/\[offline\]/g)).toHaveLength(1)
    await model.append({ ...input, event: 'recovered' }, new Date(now.getTime() + 30))
    await model.append(input, new Date(now.getTime() + 40))
    await model.append(input, new Date(now.getTime() + 60_040))
    expect((await model.read(otherUser, 'wechat', now)).text.match(/\[offline\]/g)).toHaveLength(3)
    expect((await model.read(otherUser, 'wechat', now)).text).toContain('recovered')
  })

  it('always filters seven-day-old rows and cleans them on write and maintenance', async () => {
    const old = new Date(now.getTime() - CHANNEL_LOG_RETENTION_MS - 1)
    await db.insert(schema.channelGatewayLogs).values({ userId, platform: 'qq', event: 'callback_failed', level: 'error', message: 'expired', createdAt: old })
    expect((await model.read(userId, 'qq', now)).text).not.toContain('expired')
    await model.append({ userId, platform: 'qq', event: 'disconnected' }, now)
    expect((await count()).some((row) => row.message === 'expired')).toBe(false)
    await db.insert(schema.channelGatewayLogs).values({ userId, platform: 'wechat', event: 'callback_failed', level: 'error', message: 'expired', createdAt: old })
    await model.prune(now)
    expect((await model.read(userId, 'wechat', new Date(0))).text).not.toContain('expired')
  })
})
