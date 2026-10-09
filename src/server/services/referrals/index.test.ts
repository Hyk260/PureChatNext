// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), findUser: vi.fn(), unavailable: false }))
vi.mock('server-only', () => ({}))
vi.mock('@pure/database/core/db-adaptor', () => ({ getServerDB: vi.fn() }))
vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findUser
  },
}))
vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'http://localhost:5174' } }))
vi.mock('@/envs/auth', () => ({ authEnv: { AUTH_SECRET: 'test-secret' } }))
vi.mock('@/server/services/email', () => ({
  EmailService: class {
    constructor() {
      if (mocks.unavailable) throw new Error('missing configuration')
    }
    sendMail = mocks.sendMail
  },
}))

import { ReferralModel } from '@pure/database/models/referral'
import type { Referral } from '@pure/database/schemas'
import { ReferralService, referralStatus, serializeReferral } from './index'
import { createReferralContext } from './token'

const row = (email = 'friend@qq.com', id = '2f1dff15-a679-4f4a-9b6b-6d8f7047474a'): Referral => ({
  id,
  email,
  inviterId: 'inviter',
  status: 'sending',
  createdAt: new Date(Date.now() - 61000),
  expiresAt: new Date(Date.now() + 86400000),
  acceptedAt: null,
  acceptedUserId: null,
  messageId: null,
  sentAt: null,
  error: null,
})
const fixture = (rows: Referral[], fresh = rows) => {
  const model = new ReferralModel()
  vi.spyOn(model, 'reserveBatch').mockResolvedValue({
    reservations: rows.map((item) => ({ id: item.id, email: item.email })),
    fresh,
    inviter: { fullName: '好友', username: 'friend' } as never,
  })
  vi.spyOn(model, 'finishSend').mockImplementation(async (id, patch) => {
    Object.assign(
      rows.find((item) => item.id === id)!,
      patch
    )
  })
  vi.spyOn(model, 'findMany').mockResolvedValue(rows)
  return { model, service: new ReferralService(model) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.unavailable = false
})

describe('referral email service', () => {
  it('sends individually and preserves partial failure results', async () => {
    const rows = [row(), row('other@qq.com', '89c9c24f-acdf-412b-8da8-86a28e0e6ab0')]
    mocks.sendMail.mockResolvedValueOnce({ messageId: 'sent-1' }).mockRejectedValueOnce(new Error('Mailbox rejected'))
    const { service } = fixture(rows)
    const result = await service.send(
      'inviter',
      rows.map((item) => item.email),
      'request'
    )
    expect(result.results.map((item) => item.invitation?.status)).toEqual(['sent', 'failed'])
    expect(mocks.sendMail.mock.calls[0]![0].to).toBe('friend@qq.com')
    expect(mocks.sendMail.mock.calls[1]![0].to).toBe('other@qq.com')
    expect(mocks.sendMail.mock.calls[0]![0].html).not.toContain('other@qq.com')
    expect(result.results[0]!.invitation?.link).toContain('http://localhost:5174/accept-referral?referral_context=')
  })
  it('does not send again on a replay or valid duplicate', async () => {
    const invitation = { ...row(), status: 'sent' as const }
    const { service } = fixture([invitation], [])
    expect((await service.send('inviter', [invitation.email], 'request')).results[0]!.invitation?.status).toBe('sent')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
  it('keeps ambiguous network failures non-retryable', async () => {
    mocks.sendMail.mockRejectedValue(new Error('ECONNRESET'))
    const { service } = fixture([row()])
    const item = (await service.send('inviter', ['friend@qq.com'], 'request')).results[0]!.invitation!
    expect(item.status).toBe('sending')
    expect(item.canResend).toBe(false)
    expect(item.link).toBeNull()
  })
  it('retains a late provider confirmation without sending another email', async () => {
    vi.useFakeTimers()
    try {
      let confirm: ((result: { messageId: string }) => void) | undefined
      mocks.sendMail.mockImplementation(
        () =>
          new Promise((resolve) => {
            confirm = resolve
          })
      )
      const invitation = row()
      const { service } = fixture([invitation])
      const pending = service.send('inviter', [invitation.email], 'request')
      await vi.advanceTimersByTimeAsync(15000)
      expect((await pending).results[0]!.invitation?.status).toBe('sending')
      confirm!({ messageId: 'late-confirmation' })
      await vi.advanceTimersByTimeAsync(0)
      expect(invitation.status).toBe('sent')
      expect(invitation.messageId).toBe('late-confirmation')
      expect(mocks.sendMail).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
  it('reports missing mail configuration as failed, never as success', async () => {
    mocks.unavailable = true
    const { service } = fixture([row()])
    expect((await service.send('inviter', ['friend@qq.com'], 'request')).results[0]!.invitation?.status).toBe('failed')
  })
  it('never sends to reserved test addresses', async () => {
    const { service } = fixture([row('test@example.com')])
    await service.send('inviter', ['test@example.com'], 'request')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
  it('calculates expiration at the boundary, retaining accepted status', () => {
    const invitation = row()
    expect(referralStatus(invitation, invitation.expiresAt.getTime())).toBe('expired')
    expect(referralStatus({ ...invitation, status: 'accepted' }, invitation.expiresAt.getTime())).toBe('accepted')
    expect(serializeReferral({ ...invitation, status: 'failed' }).canResend).toBe(true)
  })
  it('resolves public data without exposing the complete email', async () => {
    const invitation = row()
    const model = new ReferralModel()
    vi.spyOn(model, 'find').mockResolvedValue(invitation)
    mocks.findUser.mockResolvedValue({ fullName: '好友' })
    const context = createReferralContext(invitation.id, invitation.expiresAt, 'test-secret')
    const info = await new ReferralService(model).publicInfo(context)
    expect(JSON.stringify(info)).not.toContain(invitation.email)
    expect(info.maskedEmail).toBe('f***@qq.com')
  })
})
