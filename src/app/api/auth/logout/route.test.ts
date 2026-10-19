// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ revoke: vi.fn(), verifyRefreshToken: vi.fn() }))

vi.mock('@pure/database/models/refreshTokenFamily', () => ({
  RefreshTokenFamilyModel: class {
    revoke = mocks.revoke
  },
}))
vi.mock('@/libs/auth/jwt', () => ({ verifyRefreshToken: mocks.verifyRefreshToken }))

import { POST } from './route'

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyRefreshToken.mockResolvedValue({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      family: 'family-1',
      tokenId: 'token-1',
      valid: true,
      userId: 'user-1',
    })
    mocks.revoke.mockResolvedValue(true)
  })

  it('revokes the family belonging to a valid refresh token', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/auth/logout', {
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.revoke).toHaveBeenCalledWith({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      familyId: 'family-1',
      tokenId: 'token-1',
      userId: 'user-1',
    })
  })

  it('does not touch a token family for invalid tokens', async () => {
    mocks.verifyRefreshToken.mockResolvedValue({ expired: false, valid: false })
    const response = await POST(
      new NextRequest('http://localhost/api/auth/logout', {
        body: JSON.stringify({ refreshToken: 'invalid-token' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.revoke).not.toHaveBeenCalled()
  })

  it('revokes the HttpOnly refresh cookie and clears it for browser sign-out', async () => {
    const response = await POST(
      new NextRequest('https://localhost/api/auth/logout', {
        headers: { cookie: 'purechat_refresh_token=cookie-refresh' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.verifyRefreshToken).toHaveBeenCalledWith('cookie-refresh')
    expect(mocks.revoke).toHaveBeenCalledWith({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      familyId: 'family-1',
      tokenId: 'token-1',
      userId: 'user-1',
    })
    expect(response.headers.get('set-cookie')).toContain('purechat_refresh_token=;')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
