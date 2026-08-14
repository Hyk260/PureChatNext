// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findSignInCheck: vi.fn(),
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: {
    findSignInCheck: mocks.findSignInCheck,
  },
}))

import { POST } from './route'

const postJson = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/auth/check-user', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  )

describe('/api/auth/check-user', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing identifier', async () => {
    const response = await postJson({})
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.exists).toBe(false)
  })

  it('looks up by email', async () => {
    mocks.findSignInCheck.mockResolvedValue({
      email: 'user@example.com',
      emailVerified: true,
      hasPassword: true,
    })

    const response = await postJson({ email: 'User@Example.com' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.findSignInCheck).toHaveBeenCalledWith({ email: 'user@example.com' })
    expect(payload).toEqual({
      email: 'user@example.com',
      emailVerified: true,
      exists: true,
      hasPassword: true,
    })
  })

  it('looks up by username', async () => {
    mocks.findSignInCheck.mockResolvedValue({
      email: 'user@example.com',
      emailVerified: true,
      hasPassword: true,
    })

    const response = await postJson({ email: '2607881950' })
    const payload = await response.json()

    expect(mocks.findSignInCheck).toHaveBeenCalledWith({ username: '2607881950' })
    expect(payload.exists).toBe(true)
    expect(payload.email).toBe('user@example.com')
  })

  it('returns exists false when user is missing', async () => {
    mocks.findSignInCheck.mockResolvedValue(null)

    const response = await postJson({ email: 'missing_user' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ exists: false })
  })
})
