import debug from 'debug'

import { ReferralModel, ReferralRuleError } from '@pure/database/models/referral'
import { ReferralRewardModel } from '@pure/database/models/referralReward'
import { CreditsModel } from '@pure/database/models/credits'
import { UserModel } from '@pure/database/models/user'
import type { Referral, SignupReferral } from '@pure/database/schemas'
import type { ReferralItem, ReferralRewardRecord, ReferralStatus } from '@pure/types'
import { appEnv } from '@/envs/app'
import { authEnv } from '@/envs/auth'
import { maskReferralEmail } from '@/libs/referrals/helpers'
import { getShanghaiBillingPeriod } from '@pure/utils/billingPeriod'
import { getReferralEmailTemplate } from '@/libs/better-auth/email-templates/referral'
import { isObviousTestEmail } from '@/libs/better-auth/shared/test-email-policy'
import { EmailService } from '@/server/services/email'

import { createReferralContext, parseReferralContext } from './token'

const log = debug('email:referrals')
const recordStatus = (rewardedAt: Date | null, ineligible: boolean): ReferralRewardRecord['status'] => {
  if (rewardedAt) return 'rewarded'
  return ineligible ? 'ineligible' : 'pending'
}
const secret = () => {
  if (!authEnv.AUTH_SECRET) throw new ReferralRuleError('服务端认证密钥未配置', 503)
  return authEnv.AUTH_SECRET
}
const origin = () => {
  if (!appEnv.APP_URL) throw new ReferralRuleError('应用地址 APP_URL 未配置', 503)
  return new URL(appEnv.APP_URL).origin
}

export function referralStatus(row: Referral, now = Date.now()): ReferralStatus {
  if (row.status === 'accepted') return 'accepted'
  if (row.expiresAt.getTime() <= now) return 'expired'
  return row.status
}

export function referralLink(row: Referral) {
  const context = createReferralContext(row.id, row.expiresAt, secret())
  return `${origin()}/accept-referral?${new URLSearchParams({ referral_context: context })}`
}

export function serializeReferral(row: Referral): ReferralItem {
  const status = referralStatus(row)
  const canResend = (status === 'expired' || status === 'failed') && Date.now() - row.createdAt.getTime() >= 60000
  return {
    id: row.id,
    email: row.email,
    status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    error: row.error,
    canResend,
    link: status === 'sent' ? referralLink(row) : null,
  }
}

function isAmbiguousSend(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const cause = error instanceof Error ? error.cause : undefined
  if (cause && typeof cause === 'object' && 'responseCode' in cause) {
    const code = Number(cause.responseCode)
    if (code >= 400 && code < 600) return false
  }
  // Only a definite rejection is safe to retry; unknown errors may follow delivery.
  return !/rejected|invalid recipient|validation|missing sender|configuration|authentication|unauthorized|credentials/i.test(
    message
  )
}

export class ReferralService {
  constructor(private readonly model = new ReferralModel()) {}

  send = async (userId: string, emails: string[], requestKey: string, retryId?: string) => {
    // Validate infrastructure before reserving. Replayed batches still resolve without a mail connection.
    secret()
    origin()
    const batch = await this.model.reserveBatch(userId, emails, requestKey, retryId)
    let mailer: EmailService
    try {
      mailer = new EmailService()
    } catch {
      for (const row of batch.fresh)
        await this.model.finishSend(row.id, { status: 'failed', error: '邮件服务未配置或不可用，请联系管理员' })
      return this.batchResult(batch.reservations)
    }
    // Bounded parallel sends; each email has its own recipient and token.
    for (let start = 0; start < batch.fresh.length; start += 3) {
      await Promise.all(
        batch.fresh.slice(start, start + 3).map(async (row) => {
          let timer: ReturnType<typeof setTimeout> | undefined
          try {
            if (isObviousTestEmail(row.email)) {
              await this.model.finishSend(row.id, { status: 'failed', error: '请使用可接收邮件的真实邮箱' })
              return
            }
            const template = getReferralEmailTemplate({
              url: referralLink(row),
              userName: batch.inviter.fullName || batch.inviter.username,
            })
            const timeout = new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Referral send timeout')), 15000)
            })
            const delivery = mailer.sendMail({ to: row.email, ...template }).then(async (response) => {
              await this.model.finishSend(row.id, {
                status: 'sent',
                sentAt: new Date(),
                messageId: response.messageId,
                error: null,
              })
              return response
            })
            await Promise.race([delivery, timeout])
          } catch (error) {
            const ambiguous = isAmbiguousSend(error)
            // Never log the payload, recipient or bearer link.
            log('send failed: invitation=%s ambiguous=%s', row.id, ambiguous)
            await this.model.finishSend(row.id, {
              status: ambiguous ? 'sending' : 'failed',
              error: ambiguous ? '发送结果待确认，邮件可能已发送，请勿重复发送' : '邮件发送失败，请稍后重试',
            })
          } finally {
            if (timer) clearTimeout(timer)
          }
        })
      )
    }
    return this.batchResult(batch.reservations)
  }

  private batchResult = async (reservations: { email: string; id?: string; error?: string }[]) => {
    const ids = reservations.flatMap((item) => (item.id ? [item.id] : []))
    const rows = await this.model.findMany(ids)
    const byId = new Map(rows.map((row) => [row.id, row]))
    return {
      results: reservations.map((entry) => {
        const row = entry.id ? byId.get(entry.id) : undefined
        return row
          ? { email: entry.email, invitation: serializeReferral(row) }
          : { email: entry.email, error: entry.error || '邀请记录不可用' }
      }),
    }
  }

  resolve = async (context: string) => {
    const token = parseReferralContext(context, secret())
    if (!token) throw new ReferralRuleError('邀请链接无效', 404)
    const row = await this.model.find(token.id)
    if (!row || row.expiresAt.getTime() !== token.exp) throw new ReferralRuleError('邀请链接无效', 404)
    return row
  }

  publicInfo = async (context: string) => {
    const row = await this.resolve(context)
    const user = await new UserModel().findById(row.inviterId)
    return {
      inviterName: user?.fullName || user?.username || '一位好友',
      maskedEmail: maskReferralEmail(row.email),
      status: referralStatus(row),
      expiresAt: row.expiresAt.toISOString(),
    }
  }

  prepare = async (context: string) => {
    const row = await this.resolve(context)
    if (referralStatus(row) === 'expired') throw new ReferralRuleError('邀请已过期', 410)
    if (row.status !== 'sent') throw new ReferralRuleError('此邀请当前不可接受', 409)
    return { email: row.email, referralCode: await new ReferralRewardModel().ensureCode(row.inviterId) }
  }

  signupBinding = async (context: string, email: string): Promise<SignupReferral> => {
    const row = await this.resolve(context)
    if (referralStatus(row) === 'expired') throw new ReferralRuleError('邀请已过期', 410)
    if (row.status !== 'sent' || !row.sentAt) throw new ReferralRuleError('邀请当前不可用', 409)
    if (row.email !== email) throw new ReferralRuleError('请使用邀请收件邮箱注册', 403)
    const inviter = await new UserModel().findById(row.inviterId)
    if (!inviter || inviter.banned) throw new ReferralRuleError('邀请人账号不可用', 403)
    return { inviterId: row.inviterId, invitationId: row.id, email }
  }

  summary = async (userId: string) => {
    const model = new ReferralRewardModel()
    await model.complete(userId)
    const [summary, balance] = await Promise.all([
      model.summary(userId),
      new CreditsModel().getBalance(userId, getShanghaiBillingPeriod()),
    ])
    return {
      ...summary,
      link: `${origin()}/signup?${new URLSearchParams({ referral: summary.code })}`,
      rebateRemaining: balance.rebateRemaining,
      rebateExpiresAt: balance.rebateExpiresAt,
    }
  }

  records = async (userId: string, page: number) => {
    const result = await new ReferralRewardModel().records(userId, page)
    return {
      page,
      hasMore: result.hasMore,
      items: result.items.map((item) => ({
        id: item.id,
        maskedEmail: maskReferralEmail(item.email?.email ?? ''),
        createdAt: item.createdAt.toISOString(),
        rewardedAt: item.rewardedAt?.toISOString() ?? null,
        amount: item.amount ?? 0,
        status: recordStatus(item.rewardedAt, item.ineligible),
      })),
    }
  }

  accept = async (context: string, userId: string) => {
    const row = await this.resolve(context)
    return serializeReferral(await this.model.accept(row.id, userId))
  }
}
