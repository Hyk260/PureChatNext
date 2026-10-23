import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { referralBatches, referrals, users } from '../schemas'
import type { Referral, ReferralReservation } from '../schemas'
import type { ChatDatabase } from '../type'
import { ReferralRuleError } from './referralError'
import { ReferralRewardModel } from './referralReward'

export { ReferralRuleError } from './referralError'

export class ReferralModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  find = async (id: string) => this.db.query.referrals.findFirst({ where: eq(referrals.id, id) })

  reserveBatch = async (inviterId: string, emails: string[], requestKey: string, retryId?: string) => {
    return this.db.transaction(async (tx) => {
      // Serialize quota, duplicate checks and reservations across app instances.
      const [inviter] = await tx.select().from(users).where(eq(users.id, inviterId)).for('update')
      if (!inviter || inviter.banned) throw new ReferralRuleError('账号不可用', 403)
      const fingerprint = JSON.stringify({ emails: [...emails].sort(), retryId: retryId ?? null })
      const existing = await tx.query.referralBatches.findFirst({
        where: and(eq(referralBatches.inviterId, inviterId), eq(referralBatches.requestKey, requestKey)),
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new ReferralRuleError('请求标识已用于其他邀请', 409)
        return { reservations: existing.reservations, fresh: [], inviter }
      }
      const now = new Date()
      if (retryId) {
        const previous = await tx.query.referrals.findFirst({
          where: and(eq(referrals.id, retryId), eq(referrals.inviterId, inviterId)),
        })
        if (!previous || previous.email !== emails[0]) throw new ReferralRuleError('邀请不存在', 404)
        if (previous.status === 'accepted') throw new ReferralRuleError('邀请已接受')
        if (previous.status === 'sending' && previous.expiresAt > now)
          throw new ReferralRuleError('发送结果待确认，请勿重复发送', 409)
        if (previous.status === 'sent' && previous.expiresAt > now)
          throw new ReferralRuleError('邀请仍有效，请复制现有链接')
      }
      const [daily] = await tx
        .select({ value: count() })
        .from(referrals)
        .where(and(eq(referrals.inviterId, inviterId), gte(referrals.createdAt, new Date(now.getTime() - 86400000))))
      const [hourly] = await tx
        .select({ value: count() })
        .from(referrals)
        .where(and(eq(referrals.inviterId, inviterId), gte(referrals.createdAt, new Date(now.getTime() - 3600000))))
      let dayCount = daily!.value
      let hourCount = hourly!.value
      const reservations: ReferralReservation[] = []
      const fresh: Referral[] = []
      for (const email of emails) {
        if (email === inviter.email?.toLowerCase()) {
          reservations.push({ email, error: '不能邀请自己' })
          continue
        }
        const registered = await tx.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` })
        if (registered) {
          reservations.push({ email, error: '该邮箱已注册 PureChat' })
          continue
        }
        const latest = await tx.query.referrals.findFirst({
          where: and(eq(referrals.inviterId, inviterId), eq(referrals.email, email)),
          orderBy: [desc(referrals.createdAt), desc(referrals.id)],
        })
        if (latest && latest.expiresAt > now && (latest.status === 'sent' || latest.status === 'sending')) {
          reservations.push({ email, id: latest.id })
          continue
        }
        if (latest && now.getTime() - latest.createdAt.getTime() < 60000) {
          reservations.push({ email, error: '请在 60 秒后重试' })
          continue
        }
        if (dayCount >= 50 || hourCount >= 20) {
          reservations.push({ email, error: '邀请发送过于频繁，请稍后重试' })
          continue
        }
        const [row] = await tx
          .insert(referrals)
          .values({
            id: randomUUID(),
            inviterId,
            email,
            status: 'sending',
            createdAt: now,
            expiresAt: new Date(now.getTime() + 7 * 86400000),
          })
          .returning()
        fresh.push(row!)
        reservations.push({ email, id: row!.id })
        dayCount++
        hourCount++
      }
      await tx.insert(referralBatches).values({ id: randomUUID(), inviterId, requestKey, fingerprint, reservations })
      return { reservations, fresh, inviter }
    })
  }

  finishSend = async (id: string, patch: Partial<Pick<Referral, 'status' | 'sentAt' | 'messageId' | 'error'>>) => {
    await this.db
      .update(referrals)
      .set(patch)
      .where(and(eq(referrals.id, id), eq(referrals.status, 'sending')))
  }

  findMany = async (ids: string[]) =>
    ids.length ? this.db.select().from(referrals).where(inArray(referrals.id, ids)) : []

  history = async (inviterId: string, days: number, cursor?: { date: Date; id: string }) => {
    // Collapse retries before pagination so an older attempt cannot reappear on the next page.
    const latest = this.db
      .selectDistinctOn([referrals.email])
      .from(referrals)
      .where(eq(referrals.inviterId, inviterId))
      .orderBy(referrals.email, desc(referrals.createdAt), desc(referrals.id))
      .as('latest_referrals')
    const conditions = []
    if (days) conditions.push(gte(latest.createdAt, new Date(Date.now() - days * 86400000)))
    if (cursor)
      conditions.push(
        or(lt(latest.createdAt, cursor.date), and(eq(latest.createdAt, cursor.date), lt(latest.id, cursor.id)))!
      )
    const items = await this.db
      .select()
      .from(latest)
      .where(and(...conditions))
      .orderBy(desc(latest.createdAt), desc(latest.id))
      .limit(21)
    const [total] = await this.db
      .select({ value: count() })
      .from(referrals)
      .where(and(eq(referrals.inviterId, inviterId), inArray(referrals.status, ['sent', 'accepted'])))
    return { items: items.slice(0, 20), hasMore: items.length > 20, totalSent: total!.value }
  }

  accept = async (id: string, userId: string) => new ReferralRewardModel(this.db).acceptInvitation(id, userId)
}
