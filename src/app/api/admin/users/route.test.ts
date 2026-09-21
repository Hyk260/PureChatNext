// @vitest-environment node
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_ROLE } from '@pure/const'

const { AdminUserError, UserStorageCleanupError, mocks } = vi.hoisted(() => {
  class AdminUserError extends Error {
    constructor(
      message: string,
      public readonly code: 'conflict' | 'last_admin' | 'self'
    ) {
      super(message)
      this.name = 'AdminUserError'
    }
  }

  class UserStorageCleanupError extends Error {
    constructor(message = '用户已删除，但对象存储清理失败，请检查 S3 配置后手动清理。') {
      super(message)
      this.name = 'UserStorageCleanupError'
    }
  }

  return {
    AdminUserError,
    UserStorageCleanupError,
    mocks: {
      createUser: vi.fn(),
      deleteAdminUserWithStorage: vi.fn(),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      listUsers: vi.fn(),
      updateByAdmin: vi.fn(),
    },
  }
})

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => NextResponse.json({ error: message }, { status }),
  withAdmin: (handler: (request: Request, context: { params: Promise<Record<string, string>>; userId: string }) => unknown) => {
    return (request: Request) => handler(request, { params: Promise.resolve({}), userId: 'admin-1' })
  },
}))

vi.mock('@pure/database/models/user', () => ({
  AdminUserError,
  isAdminUserError: (error: unknown) => error instanceof AdminUserError,
  UserModel: class {
    createUser = mocks.createUser
    findByEmail = mocks.findByEmail
    findByUsername = mocks.findByUsername
    listUsers = mocks.listUsers
    updateByAdmin = mocks.updateByAdmin
  },
}))

vi.mock('@/server/services/user/cleanup-storage', () => ({
  UserStorageCleanupError,
  deleteAdminUserWithStorage: mocks.deleteAdminUserWithStorage,
}))

import { DELETE, GET, PATCH, POST } from './route'

const listUser = {
  banned: false,
  banReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'user@example.com',
  emailVerified: true,
  fullName: 'Demo',
  id: 'user-1',
  lastActiveAt: new Date('2026-01-02T00:00:00.000Z'),
  role: USER_ROLE.User,
  userId: 'biz-1',
  username: 'demo',
}

describe('/api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByEmail.mockResolvedValue(null)
    mocks.findByUsername.mockResolvedValue(null)
  })

  it('lists users from GET', async () => {
    mocks.listUsers.mockResolvedValue({ items: [listUser], total: 1 })

    const response = await GET(new Request('http://localhost/api/admin/users?page=1&pageSize=20&q=demo') as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(1)
    expect(payload.items[0]).toMatchObject({ email: 'user@example.com', username: 'demo' })
    expect(mocks.listUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20, q: 'demo' })
  })

  it('rejects create without email', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/users', {
        body: JSON.stringify({ password: 'password1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }) as never
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('email') })
  })

  it('creates a user', async () => {
    mocks.createUser.mockResolvedValue({ user: listUser })

    const response = await POST(
      new Request('http://localhost/api/admin/users', {
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password1',
          role: USER_ROLE.User,
          username: 'demo',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }) as never
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.user.email).toBe('user@example.com')
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        emailVerified: true,
        role: USER_ROLE.User,
        username: 'demo',
      })
    )
  })

  it('maps last-admin delete errors to 403', async () => {
    mocks.deleteAdminUserWithStorage.mockRejectedValue(new AdminUserError('不能移除最后一个管理员', 'last_admin'))

    const response = await DELETE(
      new Request('http://localhost/api/admin/users', {
        body: JSON.stringify({ id: 'admin-2' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      }) as never
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: '不能移除最后一个管理员' })
    expect(mocks.deleteAdminUserWithStorage).toHaveBeenCalledWith('admin-2', 'admin-1')
  })

  it('returns 502 when the user is deleted but S3 cleanup fails', async () => {
    mocks.deleteAdminUserWithStorage.mockRejectedValue(new UserStorageCleanupError())

    const response = await DELETE(
      new Request('http://localhost/api/admin/users', {
        body: JSON.stringify({ id: 'user-1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      }) as never
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: '用户已删除，但对象存储清理失败，请检查 S3 配置后手动清理。',
      ok: true,
    })
  })

  it('maps username conflict on update to 409', async () => {
    mocks.updateByAdmin.mockRejectedValue(new AdminUserError('用户名已被占用', 'conflict'))

    const response = await PATCH(
      new Request('http://localhost/api/admin/users', {
        body: JSON.stringify({ id: 'user-1', username: 'taken' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }) as never
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: '用户名已被占用' })
  })
})
