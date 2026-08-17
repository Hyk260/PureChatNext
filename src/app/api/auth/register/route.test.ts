// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createUser, findByEmail } = vi.hoisted(() => ({
  createUser: vi.fn().mockResolvedValue({ duplicate: false, user: { email: 'test@example.com', userId: 'u1' } }),
  findByEmail: vi.fn().mockResolvedValue(null),
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: { createUser, findByEmail },
}))

import { POST } from './route'

const registerRequest = (email: string, password: string) =>
  new Request('http://localhost/api/auth/register', {
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('POST /api/auth/register password validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findByEmail.mockResolvedValue(null)
  })

  it('rejects passwords shorter than 8 characters (aligned with Better Auth minPasswordLength)', async () => {
    const response = await POST(registerRequest('test@example.com', 'Abc123'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain('8')
    expect(createUser).not.toHaveBeenCalled()
  })

  it('rejects passwords exceeding 64 characters', async () => {
    const response = await POST(registerRequest('test@example.com', 'A'.repeat(65)))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain('64')
    expect(createUser).not.toHaveBeenCalled()
  })

  it('accepts an 8-character password', async () => {
    const response = await POST(registerRequest('test@example.com', 'Abcd1234'))

    expect(response.status).toBe(200)
    expect(createUser).toHaveBeenCalledOnce()
  })
})
