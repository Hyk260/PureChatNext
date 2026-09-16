import { describe, expect, it, vi } from 'vitest'

import { USER_ROLE } from '@pure/const'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { UserModel } from '../user'
import type { ChatDatabase } from '../../type'

function createDb(n: number) {
  const from = vi.fn(async () => [{ n }])
  const db = {
    select: vi.fn(() => ({ from })),
  } as unknown as ChatDatabase

  return db
}

describe('UserModel.resolveSignupRole', () => {
  it('returns admin when the users table is empty', async () => {
    await expect(new UserModel(createDb(0)).resolveSignupRole()).resolves.toBe(USER_ROLE.Admin)
  })

  it('returns user when accounts already exist', async () => {
    await expect(new UserModel(createDb(3)).resolveSignupRole()).resolves.toBe(USER_ROLE.User)
  })
})
