// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  rotate: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findByUserId = mocks.findByUserId
  },
}))
vi.mock('@pure/database/models/refreshTokenFamily', () => ({
  RefreshTokenFamilyModel: class {
    rotate = mocks.rotate
  },
}))
vi.mock('@/libs/auth/jwt', () => ({
  verifyRefreshToken: mocks.verifyRefreshToken,
  signAccessToken: mocks.signAccessToken,
  signRefreshToken: mocks.signRefreshToken,
}))
vi.mock('@/envs/auth', () => ({ authEnv: { JWT_ACCESS_EXPIRATION: '15m' } }))

import { POST } from './route'

describe('POST /api/auth/refresh ban enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyRefreshToken.mockResolvedValue({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      family: 'family-1',
      tokenId: 'token-1',
      valid: true,
      userId: 'user-1',
    })
    mocks.findByUserId.mockResolvedValue({ banned: true, banExpires: null, userId: 'user-1' })
    mocks.signRefreshToken.mockResolvedValue({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      family: 'family-1',
      token: 'next-refresh',
      tokenId: 'token-2',
    })
    mocks.rotate.mockResolvedValue(true)
  })

  it('does not rotate tokens for a banned or deleted account', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/auth/refresh', {
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.signAccessToken).not.toHaveBeenCalled()
    expect(mocks.signRefreshToken).not.toHaveBeenCalled()
    expect(mocks.rotate).not.toHaveBeenCalled()
  })

  it('rotates a valid refresh token exactly once through the family store', async () => {
    mocks.findByUserId.mockResolvedValue({ banned: false, banExpires: null, userId: 'user-1' })
    mocks.signAccessToken.mockResolvedValue('next-access')

    const response = await POST(
      new NextRequest('http://localhost/api/auth/refresh', {
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('purechat_refresh_token=next-refresh')
    await expect(response.json()).resolves.toMatchObject({ data: { accessToken: 'next-access', refreshToken: 'next-refresh' } })
    expect(mocks.signRefreshToken).toHaveBeenCalledWith('user-1', 'family-1')
    expect(mocks.rotate).toHaveBeenCalledWith({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      familyId: 'family-1',
      nextTokenId: 'token-2',
      previousTokenId: 'token-1',
      userId: 'user-1',
    })
  })

  it('rotates a refresh token from the HttpOnly cookie for browser logout sessions', async () => {
    mocks.findByUserId.mockResolvedValue({ banned: false, banExpires: null, userId: 'user-1' })
    mocks.signAccessToken.mockResolvedValue('next-access')

    const response = await POST(
      new NextRequest('http://localhost/api/auth/refresh', {
        headers: { cookie: 'purechat_refresh_token=cookie-refresh' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.verifyRefreshToken).toHaveBeenCalledWith('cookie-refresh')
    expect(response.headers.get('set-cookie')).toContain('purechat_refresh_token=next-refresh')
  })

  it('rejects a replayed or revoked refresh token', async () => {
    mocks.findByUserId.mockResolvedValue({ banned: false, banExpires: null, userId: 'user-1' })
    mocks.rotate.mockResolvedValue(false)

    const response = await POST(
      new NextRequest('http://localhost/api/auth/refresh', {
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(401)
  })
})
