// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { ReferralModel } from '../referral'
import * as schema from '../../schemas'

config({ path: resolve(import.meta.dirname, '../../../../../.env.local'), quiet: true })
const databaseUrl = process.env.DATABASE_URL
const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
const isLocal = databaseUrl && localHosts.has(new URL(databaseUrl).hostname)

// Never create test schemas on a remote deployment database.
describe.skipIf(!isLocal)('ReferralModel PostgreSQL concurrency and eligibility', () => {
  const namespace = `referral_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(databaseUrl!, { max: 1 })
  const client = postgres(databaseUrl!, { connection: { search_path: namespace } })
  const db = drizzle(client, { schema })
  const model = new ReferralModel(db)
  const sender = randomUUID()
  const secondSender = randomUUID()
  const prefix = randomUUID().slice(0, 8)
  const email = (label: string) => `${prefix}-${label}@qq.com`

  const addUser = async (id: string, recipient: string, verified = true, createdAt = new Date()) => {
    await db
      .insert(schema.users)
      .values({ id, userId: id.replaceAll('-', ''), email: recipient, emailVerified: verified, createdAt })
  }
  const send = async (inviter: string, recipient: string) => {
    const batch = await model.reserveBatch(inviter, [recipient], randomUUID())
    const row = batch.fresh[0]!
    await model.finishSend(row.id, { status: 'sent', sentAt: new Date(row.createdAt.getTime() + 1) })
    return row
  }

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    await admin.unsafe(`CREATE TABLE "${namespace}"."users" (LIKE public.users INCLUDING ALL)`)
    const migration = readFileSync(resolve(import.meta.dirname, '../../migrations/0031_round_skrulls.sql'), 'utf8')
    await client.unsafe(migration.replaceAll('"public"."users"', `"${namespace}"."users"`))
    await addUser(sender, email('sender'))
    await addUser(secondSender, email('second-sender'))
  })
  afterAll(async () => {
    await client.end()
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`)
    await admin.end()
  })

  it('rejects self and existing accounts without reserving mail attempts', async () => {
    const result = await model.reserveBatch(sender, [email('sender'), email('second-sender')], randomUUID())
    expect(result.fresh).toHaveLength(0)
    expect(result.reservations.map((item) => item.error)).toEqual(['不能邀请自己', '该邮箱已注册 PureChat'])
  })
  it('serializes idempotent batch and duplicate-email reservations', async () => {
    const key = randomUUID()
    const recipient = email('idempotent')
    const results = await Promise.all(Array.from({ length: 4 }, () => model.reserveBatch(sender, [recipient], key)))
    expect(results.flatMap((result) => result.fresh)).toHaveLength(1)
    expect(new Set(results.map((result) => result.reservations[0]!.id)).size).toBe(1)
    await expect(model.reserveBatch(sender, [email('changed')], key)).rejects.toThrow('请求标识')
    expect((await model.reserveBatch(sender, [recipient], randomUUID())).fresh).toHaveLength(0)
  })
  it('requires a matching, verified new account and accepts idempotently', async () => {
    const recipient = email('verified')
    const row = await send(sender, recipient)
    const userId = randomUUID()
    await addUser(userId, recipient, false, new Date(row.createdAt.getTime() + 1000))
    await expect(model.accept(row.id, userId)).rejects.toMatchObject({ code: 'verification_required' })
    await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, userId))
    const [first, again] = await Promise.all([model.accept(row.id, userId), model.accept(row.id, userId)])
    expect(first.acceptedUserId).toBe(userId)
    expect(again.acceptedAt).toEqual(first.acceptedAt)
  })
  it('rejects old users, wrong emails and expired links', async () => {
    const row = await send(sender, email('old'))
    const oldUser = randomUUID()
    await addUser(oldUser, row.email, true, new Date(row.createdAt.getTime() - 1000))
    await expect(model.accept(row.id, oldUser)).rejects.toThrow('仅面向新注册')
    await expect(model.accept(row.id, secondSender)).rejects.toThrow('收件邮箱')
    await db
      .update(schema.referrals)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.referrals.id, row.id))
    await expect(model.accept(row.id, oldUser)).rejects.toMatchObject({ status: 410 })
  })
  it('allows only one invitation to win for the same new user', async () => {
    const recipient = email('race')
    const one = await send(sender, recipient)
    const two = await send(secondSender, recipient)
    const userId = randomUUID()
    await addUser(userId, recipient, true, new Date(Date.now() + 1000))
    const outcomes = await Promise.allSettled([model.accept(one.id, userId), model.accept(two.id, userId)])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(await db.select().from(schema.referrals).where(eq(schema.referrals.acceptedUserId, userId))).toHaveLength(1)
  })
  it('enforces the hourly quota under concurrent reservations and counts failed attempts', async () => {
    const inviterId = randomUUID()
    await addUser(inviterId, email('quota-sender'))
    const outcomes = await Promise.all(
      Array.from({ length: 30 }, (_, index) => model.reserveBatch(inviterId, [email(`quota-${index}`)], randomUUID()))
    )
    const fresh = outcomes.flatMap((item) => item.fresh)
    expect(fresh).toHaveLength(20)
    await model.finishSend(fresh[0]!.id, { status: 'failed', error: 'rejected' })
    expect((await model.reserveBatch(inviterId, [email('quota-extra')], randomUUID())).fresh).toHaveLength(0)
    await expect(model.reserveBatch(inviterId, [fresh[0]!.email], randomUUID(), fresh[0]!.id)).resolves.toMatchObject({
      fresh: [],
    })
  })
  it('enforces the daily limit independently of the hour and paginates older history', async () => {
    const inviterId = randomUUID()
    await addUser(inviterId, email('daily-sender'))
    const createdAt = new Date(Date.now() - 2 * 3600000)
    await db.insert(schema.referrals).values(
      Array.from({ length: 50 }, (_, index) => ({
        id: randomUUID(),
        inviterId,
        email: email(`daily-${index}`),
        status: 'failed' as const,
        createdAt,
        expiresAt: new Date(Date.now() + 86400000),
      }))
    )
    const result = await model.reserveBatch(inviterId, [email('daily-extra')], randomUUID())
    expect(result.fresh).toHaveLength(0)
    expect(result.reservations[0]!.error).toContain('过于频繁')
    const first = await model.history(inviterId, 90)
    expect(first.items).toHaveLength(20)
    expect(first.hasMore).toBe(true)
    const last = first.items.at(-1)!
    const second = await model.history(inviterId, 90, { date: last.createdAt, id: last.id })
    expect(second.items).toHaveLength(20)
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(40)
  })
  it('enforces cooldown and retains an expired invitation when resending', async () => {
    const inviterId = randomUUID()
    await addUser(inviterId, email('retry-sender'))
    const recipient = email('retry')
    const row = await send(inviterId, recipient)
    await db.update(schema.referrals).set({ status: 'failed' }).where(eq(schema.referrals.id, row.id))
    expect((await model.reserveBatch(inviterId, [recipient], randomUUID(), row.id)).reservations[0]!.error).toContain(
      '60 秒'
    )
    await db
      .update(schema.referrals)
      .set({ status: 'sent', createdAt: new Date(Date.now() - 61000), expiresAt: new Date(0) })
      .where(eq(schema.referrals.id, row.id))
    const retry = await model.reserveBatch(inviterId, [recipient], randomUUID(), row.id)
    expect(retry.fresh).toHaveLength(1)
    expect(retry.fresh[0]!.id).not.toBe(row.id)
    expect(await model.find(row.id)).toMatchObject({ status: 'sent' })
  })
  it('keeps history scoped to the inviter and paginates without repeating records', async () => {
    const first = await model.history(sender, 90)
    expect(first.items.every((item) => item.inviterId === sender)).toBe(true)
    const last = first.items.at(-1)!
    const next = await model.history(sender, 90, { date: last.createdAt, id: last.id })
    expect(next.items.some((item) => first.items.some((previous) => previous.id === item.id))).toBe(false)
  })
  it('shows only the latest attempt per email across history pages without deleting attempts', async () => {
    const inviterId = randomUUID()
    await addUser(inviterId, email('history-retries'))
    const latestAt = new Date(Date.now() - 1000)
    const attempts = Array.from({ length: 25 }, (_, index) =>
      Array.from({ length: 3 }, (_, attempt) => ({
        id: randomUUID(),
        inviterId,
        email: email(`history-recipient-${index}`),
        status: attempt === 2 ? ('sent' as const) : ('failed' as const),
        createdAt: new Date(latestAt.getTime() - (2 - attempt) * 86400000),
        expiresAt: new Date(Date.now() + 86400000),
      }))
    ).flat()
    await db.insert(schema.referrals).values(attempts)
    // A newer record from another inviter must not hide this inviter's latest attempt.
    await db.insert(schema.referrals).values({
      ...attempts[0]!,
      id: randomUUID(),
      inviterId: secondSender,
      createdAt: new Date(),
    })
    for (const days of [7, 30, 90, 0]) {
      const first = await model.history(inviterId, days)
      expect(first.items).toHaveLength(20)
      expect(first.hasMore).toBe(true)
      const last = first.items.at(-1)!
      const second = await model.history(inviterId, days, { date: last.createdAt, id: last.id })
      expect(second.items).toHaveLength(5)
      expect(second.hasMore).toBe(false)
      const items = [...first.items, ...second.items]
      expect(new Set(items.map((item) => item.email)).size).toBe(25)
      expect(items.every((item) => item.status === 'sent' && item.createdAt.getTime() === latestAt.getTime())).toBe(true)
    }
    expect(await db.select().from(schema.referrals).where(eq(schema.referrals.inviterId, inviterId))).toHaveLength(75)
  })
})
