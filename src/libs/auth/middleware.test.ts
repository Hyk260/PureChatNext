// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findByUserId: vi.fn(), verifyAccessToken: vi.fn() }))

vi.mock('@/libs/auth/jwt', () => ({ verifyAccessToken: mocks.verifyAccessToken }))
vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findByUserId = mocks.findByUserId
  },
}))

import { verifyAuth } from './middleware'

describe('verifyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAccessToken.mockResolvedValue({ userId: 'user-1' })
  })

  it('rejects banned and deleted JWT accounts after signature validation', async () => {
    for (const account of [
      { banned: true, banExpires: null },
      null,
    ]) {
      mocks.findByUserId.mockResolvedValueOnce(account)
      const result = await verifyAuth(
        new NextRequest('http://localhost/api/rest-api', { headers: { authorization: 'Bearer signed-token' } })
      )
      expect(result.user).toBeNull()
      expect(result.error).toBe('账号不可用')
    }
  })
})
