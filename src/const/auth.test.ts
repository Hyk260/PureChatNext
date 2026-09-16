import { describe, expect, it } from 'vitest'

import { getUserRoleLabel, isAdminRole, USER_ROLE } from './auth'

describe('user roles', () => {
  it('treats only admin as an admin role', () => {
    expect(isAdminRole(USER_ROLE.Admin)).toBe(true)
    expect(isAdminRole(USER_ROLE.User)).toBe(false)
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
    expect(isAdminRole('superadmin')).toBe(false)
  })

  it('labels admin vs everyone else', () => {
    expect(getUserRoleLabel(USER_ROLE.Admin)).toBe('管理员')
    expect(getUserRoleLabel(USER_ROLE.User)).toBe('普通用户')
    expect(getUserRoleLabel(null)).toBe('普通用户')
  })
})
