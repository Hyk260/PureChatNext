import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn(), signRefreshToken: vi.fn() }))

vi.mock('@pure/database/models/refreshTokenFamily', () => ({
  RefreshTokenFamilyModel: class {
    create = mocks.create
  },
}))
vi.mock('./jwt', () => ({ signRefreshToken: mocks.signRefreshToken }))

import { issueRefreshToken } from './refreshTokenStore'

describe('issueRefreshToken', () => {
  it('persists token family state before returning the signed token', async () => {
    const refresh = {
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      family: 'family-1',
      token: 'refresh-token',
      tokenId: 'token-1',
    }
    mocks.signRefreshToken.mockResolvedValue(refresh)
    mocks.create.mockResolvedValue(undefined)

    await expect(issueRefreshToken('user-1')).resolves.toEqual(refresh)

    expect(mocks.signRefreshToken).toHaveBeenCalledWith('user-1')
    expect(mocks.create).toHaveBeenCalledWith({
      expiresAt: refresh.expiresAt,
      familyId: refresh.family,
      tokenId: refresh.tokenId,
      userId: 'user-1',
    })
  })
})
