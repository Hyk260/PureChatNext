// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ code: vi.fn(), mail: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@pure/database/core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))
vi.mock('@pure/database/models/referralReward', () => ({
  ReferralRewardModel: class {
    resolveCode = mocks.code
  },
}))
vi.mock('@/server/services/referrals', () => ({
  ReferralService: class {
    signupBinding = mocks.mail
  },
}))

import { ReferralRuleError } from '@pure/database/models/referral'
import { resolveSignupReferral } from '../signup-referral'

beforeEach(() => vi.resetAllMocks())

describe('signup referral trust boundary', () => {
  it('ignores referral data on OAuth and other account creation paths', async () => {
    await expect(
      resolveSignupReferral('friend@qq.com', { path: '/callback/github', body: { referralCode: 'Ab12CD34' } })
    ).resolves.toBeNull()
    expect(mocks.code).not.toHaveBeenCalled()
  })
  it('leaves ordinary email signup unbound', async () => {
    await expect(resolveSignupReferral('friend@qq.com', { path: '/sign-up/email', body: {} })).resolves.toBeNull()
  })
  it('resolves a code on the server, preserving case and normalizing the email', async () => {
    mocks.code.mockResolvedValue({ inviterId: 'inviter', invitationId: null, email: 'friend@qq.com' })
    await expect(
      resolveSignupReferral(' Friend@QQ.com ', {
        path: '/sign-up/email',
        body: {
          referralCode: ' Ab12CD34 ',
          signupReferral: { inviterId: 'forged' },
        },
      })
    ).resolves.toMatchObject({ inviterId: 'inviter' })
    expect(mocks.code).toHaveBeenCalledWith('Ab12CD34', 'friend@qq.com')
  })
  it('gives signed mail context precedence over an arbitrary code', async () => {
    mocks.mail.mockResolvedValue({ inviterId: 'mail-inviter' })
    await resolveSignupReferral('friend@qq.com', {
      path: '/sign-up/email',
      body: {
        callbackURL: '/accept-referral?referral_context=signed',
        referralCode: 'override',
      },
    })
    expect(mocks.mail).toHaveBeenCalledWith('signed', 'friend@qq.com')
    expect(mocks.code).not.toHaveBeenCalled()
  })
  it('rejects malformed inputs and translates invalid-code errors for the client', async () => {
    await expect(
      resolveSignupReferral('friend@qq.com', { path: '/sign-up/email', body: { referralCode: {} } })
    ).rejects.toMatchObject({ status: 'BAD_REQUEST' })
    mocks.code.mockRejectedValue(new ReferralRuleError('邀请码无效', 400, 'INVALID_REFERRAL_CODE'))
    await expect(
      resolveSignupReferral('friend@qq.com', { path: '/sign-up/email', body: { referralCode: 'Ab12CD34' } })
    ).rejects.toMatchObject({ body: { code: 'INVALID_REFERRAL_CODE' } })
  })
})
