// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findByUserId: vi.fn(),
  handler: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findByEmail = mocks.findByEmail
    findByUserId = mocks.findByUserId
  },
}))
vi.mock('@/auth', () => ({ auth: { handler: mocks.handler } }))
vi.mock('@/libs/auth/jwt', () => ({
  signAccessToken: mocks.signAccessToken,
  signRefreshToken: mocks.signRefreshToken,
}))
vi.mock('@/libs/utils/signature', () => ({ generateUserSig: () => 'user-sig' }))

import { POST } from './route'

describe('POST /api/auth/login compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByUserId.mockResolvedValue({ banned: false, email: 'person@example.com', userId: 'user-1' })
    mocks.findByEmail.mockResolvedValue({ banned: false, email: 'person@example.com', userId: 'user-1' })
    mocks.handler.mockResolvedValue(Response.json({ token: 'ba-session', user: { userId: 'user-1' } }))
    mocks.signAccessToken.mockResolvedValue('legacy-access')
    mocks.signRefreshToken.mockResolvedValue({ token: 'legacy-refresh' })
  })

  it('routes userId login through Better Auth before issuing legacy JWTs', async () => {
    mocks.handler.mockImplementation(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/api/auth/sign-in/email')
      expect(request.headers.get('x-forwarded-for')).toBe('203.0.113.4')
      await expect(request.json()).resolves.toMatchObject({ email: 'person@example.com', password: 'secure-pass' })
      return Response.json({ token: 'ba-session', user: { userId: 'user-1' } })
    })

    const response = await POST(
      new Request('https://app.example/api/auth/login', {
        body: JSON.stringify({ userId: 'user-1', password: 'secure-pass' }),
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.4' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      code: 200,
      data: { userId: 'user-1', userSig: 'user-sig', accessToken: 'legacy-access', refreshToken: 'legacy-refresh' },
    })
    expect(mocks.signAccessToken).toHaveBeenCalledWith('user-1')
  })

  it('does not issue tokens for banned accounts or failed Better Auth sign-ins', async () => {
    mocks.findByUserId.mockResolvedValueOnce({ banned: true, banExpires: null, email: 'person@example.com' })
    mocks.handler.mockResolvedValueOnce(Response.json({ message: 'Forbidden' }, { status: 401 }))
    const bannedResponse = await POST(
      new Request('https://app.example/api/auth/login', {
        body: JSON.stringify({ userId: 'user-1', password: 'secure-pass' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )
    expect(bannedResponse.status).toBe(401)
    expect(mocks.handler).toHaveBeenCalledOnce()

    mocks.handler.mockResolvedValueOnce(Response.json({ token: null, user: { userId: 'user-1' } }))
    const noSessionResponse = await POST(
      new Request('https://app.example/api/auth/login', {
        body: JSON.stringify({ userId: 'user-1', password: 'secure-pass' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )
    expect(noSessionResponse.status).toBe(200)
    expect(mocks.signAccessToken).not.toHaveBeenCalled()
  })
})
