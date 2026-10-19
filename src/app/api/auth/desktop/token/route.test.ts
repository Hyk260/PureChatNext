// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  findValid: vi.fn(),
  findById: vi.fn(),
  issueRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
}))

vi.mock('@pure/database/models/desktopAuth', () => ({
  DesktopAuthCodeModel: class {
    consume = mocks.consume
    findValid = mocks.findValid
  },
}))
vi.mock('@pure/database/models/user', () => ({ UserModel: class { findById = mocks.findById } }))
vi.mock('@/libs/auth/jwt', () => ({ signAccessToken: mocks.signAccessToken }))
vi.mock('@/libs/auth/refreshTokenStore', () => ({ issueRefreshToken: mocks.issueRefreshToken }))
vi.mock('@/envs/auth', () => ({ authEnv: { JWT_ACCESS_EXPIRATION: '15m' } }))

import { POST } from './route'

describe('POST /api/auth/desktop/token ban enforcement', () => {
  it('does not issue tokens when the authorized user is banned', async () => {
    const verifier = 'a'.repeat(43)
    const code = 'b'.repeat(32)
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    mocks.findValid.mockResolvedValue({ clientId: 'purechat-desktop', codeChallenge: challenge, redirectUri: 'purechat://auth/callback' })
    mocks.consume.mockResolvedValue({ userId: 'user-1' })
    mocks.findById.mockResolvedValue({ banExpires: null, banned: true, userId: 'user-1' })

    const form = new URLSearchParams({
      client_id: 'purechat-desktop',
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: 'purechat://auth/callback',
    })
    const response = await POST(
      new Request('http://localhost/api/auth/desktop/token', {
        body: form,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.signAccessToken).not.toHaveBeenCalled()
    expect(mocks.issueRefreshToken).not.toHaveBeenCalled()
  })
})
