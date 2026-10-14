// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findByUserId = mocks.findByUserId
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
    mocks.verifyRefreshToken.mockResolvedValue({ valid: true, userId: 'user-1' })
    mocks.findByUserId.mockResolvedValue({ banned: true, banExpires: null, userId: 'user-1' })
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
  })
})
