// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByUserId: vi.fn(),
  getSession: vi.fn(),
  hasCredentialAccount: vi.fn(),
  headers: vi.fn(),
  listUserAccounts: vi.fn(),
  verifyAccessToken: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('@/auth', () => ({
  auth: { api: { getSession: mocks.getSession, listUserAccounts: mocks.listUserAccounts } },
}))
vi.mock('@/libs/auth/jwt', () => ({ verifyAccessToken: mocks.verifyAccessToken }))
vi.mock('@/libs/auth/touch-last-active', () => ({ touchUserLastActive: vi.fn() }))
vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findById
    findByUserId = mocks.findByUserId
    hasCredentialAccount = mocks.hasCredentialAccount
  },
}))
vi.mock('@/server/modules/S3/config', () => ({ isS3Configured: () => false }))

import { GET } from './route'

const request = () => new NextRequest('http://localhost/api/webapi/user/profile')

const date = new Date('2026-10-09T00:00:00Z')
const user = {
  accessedAt: date,
  createdAt: date,
  id: 'auth-user-1',
  lastActiveAt: date,
  password: 'secret',
  updatedAt: date,
  userId: 'public-user-1',
}

describe('GET /api/webapi/user/profile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findById.mockResolvedValue(user)
    mocks.findByUserId.mockResolvedValue(user)
    mocks.hasCredentialAccount.mockResolvedValue(true)
    mocks.listUserAccounts.mockRejectedValue(new Error('Cookie session required'))
  })

  it('returns the profile for desktop Bearer authentication without a Cookie session', async () => {
    mocks.headers.mockResolvedValue(new Headers({ authorization: 'Bearer desktop-token' }))
    mocks.verifyAccessToken.mockResolvedValue({ userId: user.userId })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasCredentialAccount).toBe(true)
    expect(body.user.id).toBe(user.id)
    expect(body.user.createdAt).toBe(date.toISOString())
    expect(body.user).not.toHaveProperty('password')
    expect(mocks.hasCredentialAccount).toHaveBeenCalledWith(user.id)
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.listUserAccounts).not.toHaveBeenCalled()
  })

  it('supports web Cookie sessions and users without a credential account', async () => {
    mocks.headers.mockResolvedValue(new Headers({ cookie: 'session=web-session' }))
    mocks.getSession.mockResolvedValue({ user: { id: user.id } })
    mocks.hasCredentialAccount.mockResolvedValue(false)

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect((await response.json()).hasCredentialAccount).toBe(false)
    expect(mocks.hasCredentialAccount).toHaveBeenCalledWith(user.id)
  })

  it('rejects invalid desktop tokens before querying account state', async () => {
    mocks.headers.mockResolvedValue(new Headers({ authorization: 'Bearer invalid' }))
    mocks.verifyAccessToken.mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.hasCredentialAccount).not.toHaveBeenCalled()
  })

  it('returns 404 if the authenticated user no longer exists', async () => {
    mocks.headers.mockResolvedValue(new Headers({ authorization: 'Bearer desktop-token' }))
    mocks.verifyAccessToken.mockResolvedValue({ userId: user.userId })
    mocks.findById.mockResolvedValue(undefined)

    expect((await GET(request())).status).toBe(404)
    expect(mocks.hasCredentialAccount).not.toHaveBeenCalled()
  })
})
