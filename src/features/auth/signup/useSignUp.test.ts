import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  check: vi.fn(),
  signUp: vi.fn(),
  verify: vi.fn(),
  reclaim: vi.fn(),
  config: { enableEmailVerification: false, emailVerificationMode: 'otp' },
  params: new URLSearchParams(),
  warning: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => mocks.params }))
vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lobehub/ui')>()),
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), warning: mocks.warning }),
}))
vi.mock('@/libs/better-auth/client', () => ({
  checkUserByEmail: mocks.check,
  reclaimUnverifiedEmail: mocks.reclaim,
  signUp: { email: mocks.signUp },
  sendVerificationEmail: mocks.verify,
  useAuthConfig: () => ({ config: mocks.config, ready: true }),
}))
vi.mock('@/libs/analytics/acquisition', () => ({ markFirstConversion: vi.fn(), trackAcquisitionEvent: vi.fn() }))

import { useSignUp } from './useSignUp'

const callbackUrl = '/accept-referral?referral_context=test'
const values = { email: 'friend@qq.com', password: 'Example123', confirmPassword: 'Example123' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.config = { enableEmailVerification: false, emailVerificationMode: 'otp' }
  mocks.params = new URLSearchParams({ callbackUrl })
  mocks.check.mockResolvedValue({ exists: false })
  mocks.signUp.mockResolvedValue({ error: null })
  mocks.verify.mockResolvedValue({ error: null })
})
const signup = async () => {
  const { result } = renderHook(useSignUp)
  await act(async () => result.current.onSubmit(values))
}

describe('invited signup verification', () => {
  it('submits a trimmed optional code and forces verification without the global requirement', async () => {
    mocks.params = new URLSearchParams({ callbackUrl: '/chat' })
    const { result } = renderHook(useSignUp)
    await act(async () => result.current.onSubmit({ ...values, referralCode: ' Ab12CD34 ' }))
    expect(mocks.signUp).toHaveBeenCalledWith(expect.anything(), {
      body: { referralCode: 'Ab12CD34', referralContext: '' },
    })
    expect(mocks.push.mock.calls[0]![0]).toContain('/verify-email?')
  })
  it('never reclaims an existing unverified account to change its invitation attribution', async () => {
    mocks.check.mockResolvedValue({ exists: true, emailVerified: false })
    await signup()
    expect(mocks.reclaim).not.toHaveBeenCalled()
    expect(mocks.signUp).not.toHaveBeenCalled()
    expect(mocks.push.mock.calls[0]![0]).toContain('/verify-email?')
  })
  it('surfaces invalid codes as a form field error', async () => {
    mocks.signUp.mockResolvedValue({ error: { code: 'INVALID_REFERRAL_CODE', message: '邀请码无效' } })
    const { result } = renderHook(useSignUp)
    await act(async () => result.current.onSubmit({ ...values, referralCode: 'Ab12CD34' }))
    expect(result.current.referralError).toBe('邀请码无效')
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it('requires OTP verification even when the global requirement is disabled', async () => {
    await signup()
    expect(mocks.push).toHaveBeenCalledWith(
      `/verify-email?email=friend%40qq.com&callbackUrl=${encodeURIComponent(callbackUrl)}`
    )
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it('sends the link when verification is disabled and link mode is selected', async () => {
    mocks.config.emailVerificationMode = 'link'
    await signup()
    expect(mocks.verify).toHaveBeenCalledWith({ email: values.email, callbackURL: callbackUrl })
    expect(mocks.push.mock.calls[0]![0]).toContain('/verify-email?')
  })
  it('keeps the newly created account usable when sending a verification link fails', async () => {
    mocks.config.emailVerificationMode = 'link'
    mocks.verify.mockRejectedValue(new Error('network'))
    await signup()
    expect(mocks.warning).toHaveBeenCalled()
    expect(mocks.push.mock.calls[0]![0]).toContain('/verify-email?')
  })
  it('uses the existing verification path without sending a second link when globally enabled', async () => {
    mocks.config = { enableEmailVerification: true, emailVerificationMode: 'link' }
    await signup()
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.push.mock.calls[0]![0]).toContain('/verify-email?')
  })
  it('does not change ordinary registration when global verification is disabled', async () => {
    mocks.params = new URLSearchParams({ callbackUrl: '/chat' })
    await signup()
    expect(mocks.push).toHaveBeenCalledWith('/chat')
  })
})
