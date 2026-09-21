import { describe, expect, it, vi } from 'vitest'

import { USER_ROLE } from '@pure/const'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { AdminUserError, assertAdminUserMutationAllowed } from '../user'

describe('assertAdminUserMutationAllowed', () => {
  it('blocks acting on yourself', () => {
    expect(() =>
      assertAdminUserMutationAllowed({
        actorId: 'admin-1',
        activeAdminCount: 3,
        targetId: 'admin-1',
        targetRole: USER_ROLE.Admin,
      })
    ).toThrow(AdminUserError)
  })

  it('blocks removing the last admin', () => {
    expect(() =>
      assertAdminUserMutationAllowed({
        actorId: 'admin-1',
        activeAdminCount: 1,
        targetId: 'admin-2',
        targetRole: USER_ROLE.Admin,
      })
    ).toThrow(AdminUserError)
  })

  it('allows deleting a regular user', () => {
    expect(() =>
      assertAdminUserMutationAllowed({
        actorId: 'admin-1',
        activeAdminCount: 1,
        targetId: 'user-2',
        targetRole: USER_ROLE.User,
      })
    ).not.toThrow()
  })

  it('allows deleting an admin when others remain', () => {
    expect(() =>
      assertAdminUserMutationAllowed({
        actorId: 'admin-1',
        activeAdminCount: 2,
        targetId: 'admin-2',
        targetRole: USER_ROLE.Admin,
      })
    ).not.toThrow()
  })
})
