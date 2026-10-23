import { APIError } from 'better-auth/api'
import { ReferralRuleError } from '@pure/database/models/referral'
import { ReferralRewardModel } from '@pure/database/models/referralReward'

import { getReferralContext } from '@/libs/referrals/helpers'
import { ReferralService } from '@/server/services/referrals'

type SignupContext = { path?: string; body?: Record<string, unknown> } | null

/** 只信任注册请求中的码或签名邀请，服务端归属字段从不接受客户端原值。 */
export async function resolveSignupReferral(email: string, context: SignupContext) {
  if (context?.path !== '/sign-up/email') return null
  const body = context.body ?? {}
  const rawCode = body.referralCode ?? ''
  const rawContext = body.referralContext ?? ''
  if (typeof rawCode !== 'string' || typeof rawContext !== 'string')
    throw new APIError('BAD_REQUEST', { code: 'INVALID_REFERRAL_CODE', message: '邀请参数无效' })
  const params = new URLSearchParams({
    referral_context: rawContext,
    callbackUrl: typeof body.callbackURL === 'string' ? body.callbackURL : '',
  })
  const invitationContext = getReferralContext(params)
  try {
    if (invitationContext) {
      if (invitationContext.length > 2048) throw new ReferralRuleError('邀请链接无效')
      return await new ReferralService().signupBinding(invitationContext, email.trim().toLowerCase())
    }
    if (!rawCode.trim()) return null
    return await new ReferralRewardModel().resolveCode(rawCode.trim(), email.trim().toLowerCase())
  } catch (error) {
    if (!(error instanceof ReferralRuleError)) throw error
    throw new APIError('BAD_REQUEST', { code: error.code ?? 'INVALID_REFERRAL_CONTEXT', message: error.message })
  }
}

export async function completeSignupReferral(userId: string) {
  await new ReferralRewardModel().complete(userId)
}
