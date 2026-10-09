// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  findUser: vi.fn(),
  send: vi.fn(),
  history: vi.fn(),
  publicInfo: vi.fn(),
  accept: vi.fn(),
  find: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@pure/database/core/db-adaptor', () => ({ getServerDB: vi.fn() }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('@/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@/libs/auth/jwt', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('@/libs/auth/touch-last-active', () => ({ touchUserLastActive: vi.fn() }))
vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findUser
  },
}))
vi.mock('@/libs/utils/allowed-origins', () => ({
  isAllowedOrigin: (origin: string) => origin === 'http://localhost:5174',
}))
vi.mock('@pure/database/models/referral', async (importOriginal) => {
  const original = await importOriginal<typeof import('@pure/database/models/referral')>()
  return {
    ...original,
    ReferralModel: class {
      history = mocks.history
      find = mocks.find
    },
  }
})
vi.mock('@/server/services/referrals', () => ({
  ReferralService: class {
    send = mocks.send
    publicInfo = mocks.publicInfo
    accept = mocks.accept
  },
  serializeReferral: (row: unknown) => row,
}))

import { GET, POST } from './route'
import { POST as resolveInvite } from './resolve/route'
import { POST as acceptInvite } from './accept/route'
import { POST as resendInvite } from './resend/route'

const key = '2f1dff15-a679-4f4a-9b6b-6d8f7047474a'
const request = (body: unknown, endpoint = '', origin = 'http://localhost:5174') =>
  new NextRequest(`http://localhost:3000/api/webapi/referrals${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.headers.mockResolvedValue(new Headers())
  mocks.getSession.mockResolvedValue({ user: { id: 'sender' } })
  mocks.findUser.mockResolvedValue({ id: 'sender' })
  mocks.send.mockResolvedValue({ results: [] })
  mocks.history.mockResolvedValue({ items: [], hasMore: false, totalSent: 0 })
})

describe('referral API boundaries', () => {
  it('requires authentication for sending, history, resend and acceptance', async () => {
    mocks.getSession.mockResolvedValue(null)
    expect((await POST(request({ emails: ['friend@qq.com'], requestKey: key }))).status).toBe(401)
    expect((await GET(new NextRequest('http://localhost/api/webapi/referrals'))).status).toBe(401)
    expect((await acceptInvite(request({ context: 'token' }, '/accept'))).status).toBe(401)
    expect((await resendInvite(request({ id: key, requestKey: key }, '/resend'))).status).toBe(401)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('normalizes recipients and passes the authenticated sender and idempotency key', async () => {
    const response = await POST(request({ emails: [' Friend@QQ.COM ', 'friend@qq.com'], requestKey: key }))
    expect(response.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledWith('sender', ['friend@qq.com'], key)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('rejects malformed recipients, oversized batches and untrusted origins', async () => {
    expect((await POST(request({ emails: ['invalid'], requestKey: key }))).status).toBe(400)
    expect(
      (await POST(request({ emails: ['a@qq.com', 'b@qq.com', 'c@qq.com', 'd@qq.com'], requestKey: key }))).status
    ).toBe(400)
    expect(
      (await POST(request({ emails: ['friend@qq.com'], requestKey: key }, '', 'https://evil.invalid'))).status
    ).toBe(403)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('scopes history to the authenticated user and validates cursors', async () => {
    expect((await GET(new NextRequest('http://localhost/api/webapi/referrals?days=30'))).status).toBe(200)
    expect(mocks.history).toHaveBeenCalledWith('sender', 30, undefined)
    expect((await GET(new NextRequest('http://localhost/api/webapi/referrals?cursor=invalid'))).status).toBe(400)
  })
  it('resolves a public invitation without accepting it', async () => {
    mocks.publicInfo.mockResolvedValue({ maskedEmail: 'f***@qq.com' })
    expect((await resolveInvite(request({ context: 'token' }, '/resolve'))).status).toBe(200)
    expect(mocks.accept).not.toHaveBeenCalled()
  })
  it('cannot resend another user’s invitation', async () => {
    mocks.find.mockResolvedValue({ id: key, inviterId: 'other', email: 'friend@qq.com' })
    expect((await resendInvite(request({ id: key, requestKey: key }, '/resend'))).status).toBe(404)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
