// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { REFERRAL_INACTIVITY_MS, REFERRAL_REWARD_CREDITS } from '@pure/const'
import { getShanghaiBillingPeriod } from '@pure/utils'
import * as schema from '../../schemas'
import type { SignupReferral } from '../../schemas'
import { CreditsModel } from '../credits'
import { ReferralModel } from '../referral'
import { ReferralRewardModel } from '../referralReward'
import { UserModel } from '../user'

config({ path: resolve(import.meta.dirname, '../../../../../.env.local'), quiet: true })
const databaseUrl = process.env.DATABASE_URL
const isLocal = databaseUrl && new Set(['localhost', '127.0.0.1', '::1']).has(new URL(databaseUrl).hostname)

describe.skipIf(!isLocal)('referral rewards and rebate settlement (isolated PostgreSQL)', () => {
  const namespace = `reward_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(databaseUrl!, { max: 1 })
  const client = postgres(databaseUrl!, { connection: { search_path: namespace } })
  const db = drizzle(client, { schema })
  const rewards = new ReferralRewardModel(db)
  const credits = new CreditsModel(db)
  const users = new UserModel(db)
  const period = getShanghaiBillingPeriod()
  const email = () => `${randomUUID()}@qq.com`

  const addUser = async (binding: SignupReferral | null = null, verified = true) => {
    const id = randomUUID()
    const address = binding?.email ?? email()
    await db.insert(schema.users).values({
      id,
      userId: id.replaceAll('-', ''),
      email: address,
      emailVerified: verified,
      signupReferral: binding,
    })
    return id
  }
  const pair = async (verified = true) => {
    const inviter = await addUser()
    const invitee = await addUser({ inviterId: inviter, invitationId: null, email: email() }, verified)
    return { inviter, invitee }
  }
  const wallet = (userId: string) => db.query.userRebates.findFirst({ where: eq(schema.userRebates.userId, userId) })
  const charge = (userId: string, amount: number, messageId = randomUUID()) =>
    credits.chargeChatUsage({
      userId,
      credits: amount,
      messageId,
      period,
      durationMs: 1,
      model: 'test-model',
      provider: 'purechat',
      trigger: 'web',
    })
  const mailPair = async (bound = true) => {
    const inviter = await addUser()
    const invitationId = randomUUID()
    const recipient = email()
    const sentAt = new Date(Date.now() - 1000)
    await db.insert(schema.referrals).values({
      id: invitationId,
      inviterId: inviter,
      email: recipient,
      status: 'sent',
      sentAt,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const invitee = await addUser(bound ? { inviterId: inviter, invitationId, email: recipient } : null)
    if (!bound) await db.update(schema.users).set({ email: recipient }).where(eq(schema.users.id, invitee))
    return { inviter, invitee, invitationId }
  }

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    for (const table of [
      'users',
      'referrals',
      'referral_batches',
      'user_credits',
      'credit_ledger',
      'user_rebates',
      'referral_rewards',
    ]) {
      await admin.unsafe(`CREATE TABLE "${namespace}"."${table}" (LIKE public."${table}" INCLUDING ALL)`)
    }
  })
  afterAll(async () => {
    await client.end()
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`)
    await admin.end()
  })

  it('allocates a stable unique code concurrently and preserves case', async () => {
    const inviter = await addUser()
    const codes = await Promise.all(Array.from({ length: 8 }, () => rewards.ensureCode(inviter)))
    expect(new Set(codes).size).toBe(1)
    expect(codes[0]).toMatch(/^[A-Za-z0-9]{8}$/)
    await db.update(schema.users).set({ referralCode: 'Ab12CD34' }).where(eq(schema.users.id, inviter))
    expect(await rewards.resolveCode('Ab12CD34', email())).toMatchObject({ inviterId: inviter })
    await expect(rewards.resolveCode('ab12cd34', email())).rejects.toMatchObject({ code: 'INVALID_REFERRAL_CODE' })
    const sender = await db.query.users.findFirst({ where: eq(schema.users.id, inviter) })
    await expect(rewards.resolveCode('Ab12CD34', sender!.email!)).rejects.toThrow('不可用')
  })

  it('requires verification and awards both parties once across concurrent callbacks', async () => {
    const { inviter, invitee } = await pair(false)
    expect(await rewards.complete(invitee)).toBe(false)
    expect(await wallet(inviter)).toBeUndefined()
    await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, invitee))
    await Promise.all(Array.from({ length: 12 }, () => rewards.complete(invitee)))
    expect((await wallet(inviter))!.balance).toBe(REFERRAL_REWARD_CREDITS)
    expect((await wallet(invitee))!.balance).toBe(REFERRAL_REWARD_CREDITS)
    const ledger = await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.referralRewardId, invitee))
    expect(ledger).toHaveLength(2)
    expect(ledger.every((row) => row.reason === 'referral_reward' && row.delta === REFERRAL_REWARD_CREDITS)).toBe(true)
  })

  it('accepts email and grants rewards atomically with verification and acceptance racing', async () => {
    const { inviter, invitee, invitationId } = await mailPair()
    await Promise.all(
      Array.from({ length: 6 }, () =>
        Promise.all([rewards.complete(invitee), new ReferralModel(db).accept(invitationId, invitee)])
      )
    )
    expect((await wallet(inviter))!.balance).toBe(REFERRAL_REWARD_CREDITS)
    expect((await wallet(invitee))!.balance).toBe(REFERRAL_REWARD_CREDITS)
    expect(await db.query.referrals.findFirst({ where: eq(schema.referrals.id, invitationId) })).toMatchObject({
      status: 'accepted',
      acceptedUserId: invitee,
    })
  })

  it('keeps legacy mail acceptance working without retroactive rewards', async () => {
    const { inviter, invitee, invitationId } = await mailPair(false)
    await rewards.acceptInvitation(invitationId, invitee)
    expect(await rewards.complete(invitee)).toBe(false)
    expect(await wallet(inviter)).toBeUndefined()
    expect(await wallet(invitee)).toBeUndefined()
  })

  it('rolls back invitation acceptance, both balances and ledgers when one credit fails', async () => {
    const { inviter, invitee, invitationId } = await mailPair()
    await client.unsafe(
      `ALTER TABLE credit_ledger ADD CONSTRAINT test_reward_failure CHECK (reason <> 'referral_reward' OR user_id <> '${inviter}')`
    )
    try {
      await expect(rewards.acceptInvitation(invitationId, invitee)).rejects.toThrow()
      expect(await wallet(inviter)).toBeUndefined()
      expect(await wallet(invitee)).toBeUndefined()
      expect(
        await db.query.referralRewards.findFirst({ where: eq(schema.referralRewards.inviteeId, invitee) })
      ).toBeUndefined()
      expect((await db.query.referrals.findFirst({ where: eq(schema.referrals.id, invitationId) }))!.status).toBe(
        'sent'
      )
    } finally {
      await client.unsafe('ALTER TABLE credit_ledger DROP CONSTRAINT test_reward_failure')
    }
    expect(await rewards.complete(invitee)).toBe(true)
  })

  it('rejects expired mail, changed mailbox, banned accounts and conflicting attribution', async () => {
    const expired = await mailPair()
    await db
      .update(schema.referrals)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.referrals.id, expired.invitationId))
    expect(await rewards.complete(expired.invitee)).toBe(false)
    const changed = await pair()
    await db.update(schema.users).set({ email: email() }).where(eq(schema.users.id, changed.invitee))
    expect(await rewards.complete(changed.invitee)).toBe(false)
    expect(await wallet(changed.inviter)).toBeUndefined()
    const banned = await pair()
    await db.update(schema.users).set({ banned: true }).where(eq(schema.users.id, banned.inviter))
    expect(await rewards.complete(banned.invitee)).toBe(false)
    const conflict = await mailPair()
    const otherInviter = await addUser()
    await db
      .update(schema.users)
      .set({ signupReferral: { inviterId: otherInviter, invitationId: null, email: email() } })
      .where(eq(schema.users.id, conflict.invitee))
    await expect(rewards.acceptInvitation(conflict.invitationId, conflict.invitee)).rejects.toThrow('其他邀请')
  })

  it('deducts free credits before rebates and records one split consumption for retries', async () => {
    const { invitee } = await pair()
    await rewards.complete(invitee)
    await db.insert(schema.userCredits).values({ userId: invitee, period, grant: 100, used: 90 })
    const messageId = randomUUID()
    expect(await charge(invitee, 30, messageId)).toEqual({ charged: 30, skipped: false })
    expect(await charge(invitee, 30, messageId)).toEqual({ charged: 0, skipped: true })
    const balance = await credits.getBalance(invitee, period)
    expect(balance).toMatchObject({
      used: 100,
      remaining: 0,
      rebateRemaining: REFERRAL_REWARD_CREDITS - 20,
      totalRemaining: REFERRAL_REWARD_CREDITS - 20,
    })
    expect(
      await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.messageId, messageId) })
    ).toMatchObject({ credits: 30, monthlyCredits: 10, rebateCredits: 20, delta: -30 })
    await expect(credits.assertCanChat(invitee, period, 1)).resolves.toMatchObject({ remaining: 0 })
  })

  it('serializes parallel charges and duplicate message settlement without negative balances', async () => {
    const userId = await addUser()
    await db.insert(schema.userCredits).values({ userId, period, grant: 10, used: 0 })
    await db.insert(schema.userRebates).values({ userId, balance: 40, expiresAt: new Date(Date.now() + 86400000) })
    const duplicate = randomUUID()
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => charge(userId, 5, index < 3 ? duplicate : randomUUID()))
    )
    expect(results.reduce((total, result) => total + result.charged, 0)).toBe(50)
    expect((await wallet(userId))!.balance).toBe(0)
    expect((await credits.getBalance(userId, period)).used).toBe(10)
    expect(
      await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.messageId, duplicate))
    ).toHaveLength(1)
  })

  it('clears exactly at expiry before concurrent activity can renew the wallet', async () => {
    const userId = await addUser()
    const now = new Date()
    await db
      .update(schema.users)
      .set({ lastActiveAt: new Date(now.getTime() - REFERRAL_INACTIVITY_MS) })
      .where(eq(schema.users.id, userId))
    await db.insert(schema.userRebates).values({ userId, balance: 1234, expiresAt: now })
    await Promise.all(Array.from({ length: 8 }, () => users.touchLastActiveAt(userId, now)))
    expect(await wallet(userId)).toMatchObject({
      balance: 0,
      expiresAt: new Date(now.getTime() + REFERRAL_INACTIVITY_MS),
    })
    const expired = await db
      .select()
      .from(schema.creditLedger)
      .where(and(eq(schema.creditLedger.userId, userId), eq(schema.creditLedger.reason, 'referral_expire')))
    expect(expired).toHaveLength(1)
    expect(expired[0]!.delta).toBe(-1234)
  })

  it('renews an unexpired wallet without clearing it', async () => {
    const userId = await addUser()
    const now = new Date()
    await db
      .update(schema.users)
      .set({ lastActiveAt: new Date(now.getTime() - 86400000) })
      .where(eq(schema.users.id, userId))
    await db.insert(schema.userRebates).values({ userId, balance: 99, expiresAt: new Date(now.getTime() + 1) })
    await users.touchLastActiveAt(userId, now)
    expect(await wallet(userId)).toMatchObject({
      balance: 99,
      expiresAt: new Date(now.getTime() + REFERRAL_INACTIVITY_MS),
    })
  })

  it('clears old dormant balances before a new reward and starts a fresh 90 days', async () => {
    const { inviter, invitee } = await pair()
    await db.insert(schema.userRebates).values({ userId: inviter, balance: 600_000, expiresAt: new Date(0) })
    const before = Date.now()
    await rewards.complete(invitee)
    const current = (await wallet(inviter))!
    expect(current.balance).toBe(REFERRAL_REWARD_CREDITS)
    expect(current.expiresAt.getTime()).toBeGreaterThanOrEqual(before + REFERRAL_INACTIVITY_MS)
    expect(
      await db.query.creditLedger.findFirst({
        where: and(eq(schema.creditLedger.userId, inviter), eq(schema.creditLedger.reason, 'referral_expire')),
      })
    ).toMatchObject({ delta: -600_000 })
  })

  it('preserves rebates across months and administrator free-credit resets', async () => {
    const { invitee } = await pair()
    await rewards.complete(invitee)
    await credits.getBalance(invitee, '2026-01')
    const next = await credits.getBalance(invitee, '2026-02')
    expect(next.rebateRemaining).toBe(REFERRAL_REWARD_CREDITS)
    expect((await credits.resetPeriod(invitee, '2026-02')).rebateRemaining).toBe(REFERRAL_REWARD_CREDITS)
    await db.update(schema.userRebates).set({ balance: 3_000_000_000 }).where(eq(schema.userRebates.userId, invitee))
    expect((await credits.getBalance(invitee, '2026-02')).rebateRemaining).toBe(3_000_000_000)
    await db
      .update(schema.userRebates)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.userRebates.userId, invitee))
    expect((await credits.getBalance(invitee, '2026-02')).rebateRemaining).toBe(0)
    expect(
      await db.query.creditLedger.findFirst({
        where: and(eq(schema.creditLedger.userId, invitee), eq(schema.creditLedger.reason, 'referral_expire')),
      })
    ).toMatchObject({ delta: -3_000_000_000, credits: 3_000_000_000 })
  })

  it('excludes expired balances from reads and prechecks, preserving historical rewards', async () => {
    const { inviter, invitee } = await pair()
    await rewards.complete(invitee)
    await db.insert(schema.userCredits).values({ userId: inviter, period, grant: 10, used: 10 })
    await db
      .update(schema.userRebates)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.userRebates.userId, inviter))
    expect(await credits.getBalance(inviter, period)).toMatchObject({
      remaining: 0,
      rebateRemaining: 0,
      totalRemaining: 0,
    })
    await expect(credits.assertCanChat(inviter, period, 1)).rejects.toMatchObject({ code: 'FreePlanLimit' })
    expect(await rewards.summary(inviter)).toMatchObject({ totalEarned: REFERRAL_REWARD_CREDITS, totalRewarded: 1 })
  })

  it('scopes summary and pages to the inviter with pending and rewarded accounts', async () => {
    const { inviter, invitee } = await pair()
    await rewards.complete(invitee)
    for (let index = 0; index < 24; index++) {
      await addUser({ inviterId: inviter, invitationId: null, email: email() }, false)
    }
    await pair()
    expect(await rewards.summary(inviter)).toMatchObject({
      totalInvited: 25,
      totalRewarded: 1,
      totalEarned: REFERRAL_REWARD_CREDITS,
    })
    const first = await rewards.records(inviter, 1)
    const second = await rewards.records(inviter, 2)
    expect(first.items).toHaveLength(20)
    expect(first.hasMore).toBe(true)
    expect(second.items).toHaveLength(5)
    expect(second.hasMore).toBe(false)
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(25)
    expect(
      (await db.execute(sql`select count(*)::int as total from referral_rewards where inviter_id = ${inviter}`))[0]!
        .total
    ).toBe(1)
  })
})
