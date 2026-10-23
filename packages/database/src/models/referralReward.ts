import { randomInt } from 'node:crypto'
import { REFERRAL_REWARD_CREDITS } from '@pure/const'
import { createNanoId, getShanghaiBillingPeriod } from '@pure/utils'
import { and, asc, count, desc, eq, inArray, isNull, sql, sum } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { creditLedger, userRebates } from '../schemas/credits'
import { referralRewards, referrals } from '../schemas/referral'
import { users } from '../schemas/user'
import type { SignupReferral } from '../schemas/user'
import type { ChatDatabase } from '../type'
import { expireRebate, rebateExpiry } from './rebate'
import { ReferralRuleError } from './referralError'

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const ledgerId = createNanoId(21)
const inviterScope = (userId: string) => sql`${users.signupReferral}->>'inviterId' = ${userId}`

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === '23505') return true
  return 'cause' in error && isUniqueViolation(error.cause)
}

export class ReferralRewardModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  ensureCode = async (userId: string) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) })
      if (!user || user.banned) throw new ReferralRuleError('账号不可用', 403)
      if (user.referralCode) return user.referralCode
      const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
      try {
        const [updated] = await this.db
          .update(users)
          .set({ referralCode: code })
          .where(and(eq(users.id, userId), isNull(users.referralCode)))
          .returning({ code: users.referralCode })
        if (updated?.code) return updated.code
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
      }
    }
    throw new ReferralRuleError('邀请码生成失败，请重试', 503)
  }

  resolveCode = async (code: string, email: string): Promise<SignupReferral> => {
    if (!/^[A-Za-z0-9]{8}$/.test(code)) throw new ReferralRuleError('邀请码无效', 400, 'INVALID_REFERRAL_CODE')
    const inviter = await this.db.query.users.findFirst({ where: eq(users.referralCode, code) })
    if (!inviter || inviter.banned || inviter.email?.toLowerCase() === email)
      throw new ReferralRuleError('邀请码无效或不可用', 400, 'INVALID_REFERRAL_CODE')
    return { inviterId: inviter.id, invitationId: null, email }
  }

  /** 既供验证钩子调用，也供鉴权后的补偿调用；业务不满足不会阻断邮箱验证。 */
  complete = async (userId: string) => {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user?.signupReferral || !user.emailVerified || user.email?.toLowerCase() !== user.signupReferral.email)
      return false
    const rewarded = await this.db.query.referralRewards.findFirst({ where: eq(referralRewards.inviteeId, userId) })
    if (rewarded) return true
    try {
      await this.settle(userId, user.signupReferral.invitationId)
      return true
    } catch (error) {
      if (error instanceof ReferralRuleError) return false
      throw error
    }
  }

  acceptInvitation = async (invitationId: string, userId: string) => {
    const result = await this.settle(userId, invitationId)
    if (!result) throw new ReferralRuleError('邀请不存在', 404)
    return result
  }

  private settle = async (userId: string, invitationId: string | null) => {
    const snapshot = await this.db.query.users.findFirst({ where: eq(users.id, userId) })
    const mail = invitationId
      ? await this.db.query.referrals.findFirst({ where: eq(referrals.id, invitationId) })
      : null
    const inviterId = mail?.inviterId ?? snapshot?.signupReferral?.inviterId
    if (!inviterId || (invitationId && !mail)) throw new ReferralRuleError('邀请不存在', 404)

    return this.db.transaction(async (tx) => {
      // 两个用户、邮件邀请、余额依次加锁；分享、发奖、扣费、活跃续期遵守同一顺序。
      const accounts = await tx
        .select()
        .from(users)
        .where(inArray(users.id, [userId, inviterId]))
        .orderBy(asc(users.id))
        .for('update')
      const user = accounts.find((item) => item.id === userId)
      const inviter = accounts.find((item) => item.id === inviterId)
      if (!user || !inviter || user.banned || inviter.banned) throw new ReferralRuleError('账号不可用', 403)
      if (userId === inviterId) throw new ReferralRuleError('不能邀请自己', 403)
      if (
        user.signupReferral &&
        (user.signupReferral.inviterId !== inviterId || user.signupReferral.invitationId !== invitationId)
      )
        throw new ReferralRuleError('该账号已绑定其他邀请', 409)
      if (!user.emailVerified) throw new ReferralRuleError('请先验证邀请收件邮箱', 403, 'verification_required')
      const now = new Date()
      let invitation = invitationId
        ? (await tx.select().from(referrals).where(eq(referrals.id, invitationId)).for('update'))[0]
        : undefined
      if (invitationId) {
        if (!invitation) throw new ReferralRuleError('邀请不存在', 404)
        if (invitation.acceptedUserId !== userId) {
          if (invitation.status === 'accepted') throw new ReferralRuleError('邀请已被接受', 409)
          if (invitation.expiresAt <= now) throw new ReferralRuleError('邀请已过期', 410)
          if (invitation.status !== 'sent' || !invitation.sentAt) throw new ReferralRuleError('邀请尚未发送成功', 409)
          if (user.email?.toLowerCase() !== invitation.email)
            throw new ReferralRuleError('请使用邀请收件邮箱注册的账号', 403)
          if (user.createdAt < invitation.sentAt) throw new ReferralRuleError('此邀请仅面向新注册用户', 403)
          const already = await tx.query.referrals.findFirst({ where: eq(referrals.acceptedUserId, userId) })
          if (already) throw new ReferralRuleError('该账号已接受其他邀请', 409)
          ;[invitation] = await tx
            .update(referrals)
            .set({ status: 'accepted', acceptedAt: now, acceptedUserId: userId })
            .where(eq(referrals.id, invitationId))
            .returning()
        }
      }

      const binding = user.signupReferral
      const eligible =
        binding?.inviterId === inviterId &&
        binding.invitationId === invitationId &&
        binding.email === user.email?.toLowerCase()
      // 存量账号没有注册归属：继续兼容接受旧邮件，但不补发奖励。
      if (!eligible) return invitation
      const [reward] = await tx
        .insert(referralRewards)
        .values({
          inviteeId: userId,
          inviterId,
          invitationId,
          source: invitationId ? 'email' : 'code',
          amount: REFERRAL_REWARD_CREDITS,
          rewardedAt: now,
        })
        .onConflictDoNothing()
        .returning()
      if (!reward) return invitation
      for (const recipient of [...new Set([userId, inviterId])].sort()) {
        await expireRebate(tx, recipient, now)
        await tx
          .insert(userRebates)
          .values({
            userId: recipient,
            balance: reward.amount,
            expiresAt: rebateExpiry(now),
          })
          .onConflictDoUpdate({
            target: userRebates.userId,
            set: {
              balance: sql`${userRebates.balance} + ${reward.amount}`,
              expiresAt: rebateExpiry(now),
            },
          })
        await tx.insert(creditLedger).values({
          id: ledgerId(),
          userId: recipient,
          period: getShanghaiBillingPeriod(now),
          reason: 'referral_reward',
          referralRewardId: userId,
          delta: reward.amount,
          credits: reward.amount,
          monthlyCredits: 0,
          rebateCredits: reward.amount,
          createdAt: now,
        })
      }
      return invitation
    })
  }

  summary = async (userId: string) => {
    const [code, [bound], [rewarded]] = await Promise.all([
      this.ensureCode(userId),
      this.db.select({ total: count() }).from(users).where(inviterScope(userId)),
      this.db
        .select({ total: count(), amount: sum(referralRewards.amount) })
        .from(referralRewards)
        .where(eq(referralRewards.inviterId, userId)),
    ])
    return {
      code,
      totalInvited: bound!.total,
      totalRewarded: rewarded!.total,
      totalEarned: Number(rewarded!.amount ?? 0),
    }
  }

  records = async (userId: string, page: number) => {
    const items = await this.db
      .select({
        id: users.id,
        email: users.signupReferral,
        createdAt: users.createdAt,
        rewardedAt: referralRewards.rewardedAt,
        amount: referralRewards.amount,
        ineligible: sql<boolean>`coalesce(${referrals.expiresAt} <= now(), false) OR ${users.email} IS DISTINCT FROM ${users.signupReferral}->>'email'`,
      })
      .from(users)
      .leftJoin(referralRewards, eq(referralRewards.inviteeId, users.id))
      .leftJoin(referrals, sql`${referrals.id} = ${users.signupReferral}->>'invitationId'`)
      .where(inviterScope(userId))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(21)
      .offset((page - 1) * 20)
    return { items: items.slice(0, 20), hasMore: items.length > 20 }
  }
}
