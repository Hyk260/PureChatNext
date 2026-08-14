// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUsername: vi.fn(),
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: {
    findByUsername: mocks.findByUsername,
  },
}))

import { POST } from './route'

const postJson = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/auth/check-username', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  )

describe('/api/auth/check-username', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid username', async () => {
    const response = await postJson({ username: 'not valid' })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.taken).toBe(false)
    expect(mocks.findByUsername).not.toHaveBeenCalled()
  })

  it('returns taken true when username exists', async () => {
    mocks.findByUsername.mockResolvedValue({ id: 'user-1' })

    const response = await postJson({ username: '2607881950' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.findByUsername).toHaveBeenCalledWith('2607881950')
    expect(payload).toEqual({ taken: true })
  })

  it('returns taken false when username is free', async () => {
    mocks.findByUsername.mockResolvedValue(undefined)

    const response = await postJson({ username: 'fresh_user' })
    const payload = await response.json()

    expect(payload).toEqual({ taken: false })
  })
})
