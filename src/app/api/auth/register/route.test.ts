// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ handler: vi.fn() }))

vi.mock('@/auth', () => ({ auth: { handler: mocks.handler } }))
vi.mock('@/libs/logger', () => ({ logger: { error: vi.fn() } }))

import { POST } from './route'

describe('POST /api/auth/register compatibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates signup policy to Better Auth and preserves request context and response cookies', async () => {
    mocks.handler.mockImplementation(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/api/auth/sign-up/email')
      expect(request.headers.get('origin')).toBe('https://app.example')
      expect(request.headers.get('x-forwarded-for')).toBe('203.0.113.4')
      await expect(request.json()).resolves.toEqual({ email: 'person@example.com', name: 'person', password: 'secure-pass' })
      return Response.json(
        { user: { email: 'person@example.com', userId: 'user-1' } },
        { headers: { 'set-cookie': 'better-auth.session=opaque; HttpOnly' } }
      )
    })

    const response = await POST(
      new Request('https://app.example/api/auth/register', {
        body: JSON.stringify({ email: 'person@example.com', password: 'secure-pass' }),
        headers: {
          'content-type': 'application/json',
          'content-length': '999',
          origin: 'https://app.example',
          'x-forwarded-for': '203.0.113.4',
        },
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('better-auth.session=opaque')
    await expect(response.json()).resolves.toEqual({
      message: '注册成功',
      code: 200,
      data: { email: 'person@example.com', userId: 'user-1' },
    })
  })
})
