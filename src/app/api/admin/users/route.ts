import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { USER_ROLE } from '@pure/const'
import type { UserRole } from '@pure/const'
import { isRecord, toTrimmedString } from '@pure/utils/object'
import { isAdminUserError, UserModel } from '@pure/database/models/user'
import type { AdminUserSortBy } from '@pure/database/models/user'

import { jsonError, withAdmin } from '@/libs/auth/get-session-user'
import {
  allocateUniqueUsername,
  LOGIN_USERNAME_REGEX,
  normalizeLoginIdentifier,
} from '@/libs/better-auth/shared'
import { deleteAdminUserWithStorage, UserStorageCleanupError } from '@/server/services/user/cleanup-storage'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const ADMIN_USER_SORT_FIELDS = new Set<AdminUserSortBy>(['lastActiveAt', 'role'])
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 64

type AdminUserJson = {
  banned: boolean
  banReason: string | null
  createdAt: string
  email: string | null
  emailVerified: boolean
  fullName: string | null
  id: string
  lastActiveAt: string
  role: string | null
  userId: string
  username: string | null
}

const parsePositiveInt = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

const parseRole = (value: unknown): UserRole | undefined | 'invalid' => {
  if (value === undefined || value === null || value === '') return undefined
  if (value === USER_ROLE.Admin || value === USER_ROLE.User) return value
  return 'invalid'
}

const serializeAdminUser = (user: {
  banned?: boolean | null
  banReason?: string | null
  createdAt: Date
  email?: string | null
  emailVerified: boolean
  fullName?: string | null
  id: string
  lastActiveAt?: Date
  role?: string | null
  userId: string
  username?: string | null
}): AdminUserJson => {
  const createdAt = user.createdAt
  const lastActiveAt = user.lastActiveAt ?? createdAt
  return {
    banned: user.banned === true,
    banReason: user.banReason ?? null,
    createdAt: createdAt.toISOString(),
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    fullName: user.fullName ?? null,
    id: user.id,
    lastActiveAt: lastActiveAt.toISOString(),
    role: user.role ?? null,
    userId: user.userId,
    username: user.username ?? null,
  }
}

const adminUserErrorResponse = (error: unknown) => {
  if (!isAdminUserError(error)) return null
  if (error.code === 'conflict') return jsonError(error.message, 409)
  return jsonError(error.message, 403)
}

const parseJsonBody = async (request: NextRequest) => {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

const parseSortBy = (value: string | null): AdminUserSortBy | undefined => {
  if (value && ADMIN_USER_SORT_FIELDS.has(value as AdminUserSortBy)) return value as AdminUserSortBy
  return undefined
}

/**
 * GET /api/admin/users
 * 分页列出用户，支持邮箱 / 用户名 / 全名搜索，以及按角色 / 最近活跃排序。
 */
export const GET = withAdmin(async (request) => {
  const url = new URL(request.url)
  const page = parsePositiveInt(url.searchParams.get('page'), DEFAULT_PAGE, Number.MAX_SAFE_INTEGER)
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const q = toTrimmedString(url.searchParams.get('q')) ?? undefined
  const sortBy = parseSortBy(url.searchParams.get('sortBy'))
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const { items, total } = await new UserModel().listUsers({
    page,
    pageSize,
    q,
    ...(sortBy ? { sortBy, sortOrder } : {}),
  })

  return NextResponse.json({
    items: items.map(serializeAdminUser),
    page,
    pageSize,
    total,
  })
})

/**
 * POST /api/admin/users
 * 管理员创建用户。
 * @param request - JSON `{ email, password, username?, role? }`
 */
export const POST = withAdmin(async (request) => {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) return jsonError('Invalid JSON body')

  const identifier = typeof body.email === 'string' ? normalizeLoginIdentifier(body.email) : null
  if (!identifier || identifier.kind !== 'email') {
    return jsonError('Missing or invalid "email" field')
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return jsonError(`Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`)
  }

  const role = parseRole(body.role)
  if (role === 'invalid') return jsonError('Invalid role')

  const requestedUsername = toTrimmedString(body.username)
  if (requestedUsername && !LOGIN_USERNAME_REGEX.test(requestedUsername)) {
    return jsonError('Invalid username')
  }

  const userModel = new UserModel()
  if (await userModel.findByEmail(identifier.value)) {
    return jsonError('该邮箱已被注册', 409)
  }

  if (requestedUsername && (await userModel.findByUsername(requestedUsername))) {
    return jsonError('用户名已被占用', 409)
  }

  const username =
    requestedUsername ??
    (await allocateUniqueUsername(identifier.value.split('@')[0] ?? identifier.value, async (candidate) =>
      Boolean(await userModel.findByUsername(candidate))
    ))

  const created = await userModel.createUser({
    email: identifier.value,
    emailVerified: true,
    password,
    role: role ?? USER_ROLE.User,
    username,
  })

  return NextResponse.json({ user: serializeAdminUser(created.user) }, { status: 201 })
})

/**
 * PATCH /api/admin/users
 * 管理员更新用户角色、资料或封禁状态。
 * @param request - JSON `{ id, username?, fullName?, role?, banned?, banReason? }`
 */
export const PATCH = withAdmin(async (request, { userId: actorId }) => {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) return jsonError('Invalid JSON body')

  const id = toTrimmedString(body.id)
  if (!id) return jsonError('Missing or invalid "id" field')

  const role = parseRole(body.role)
  if (role === 'invalid') return jsonError('Invalid role')

  const username = body.username === undefined ? undefined : toTrimmedString(body.username)
  if (username !== undefined && (!username || !LOGIN_USERNAME_REGEX.test(username))) {
    return jsonError('Invalid username')
  }

  const fullName = body.fullName === undefined ? undefined : toTrimmedString(body.fullName)
  const banned = typeof body.banned === 'boolean' ? body.banned : undefined
  const banReason = body.banReason === undefined ? undefined : toTrimmedString(body.banReason)

  try {
    const updated = await new UserModel().updateByAdmin(id, actorId, {
      ...(banReason !== undefined ? { banReason } : {}),
      ...(banned !== undefined ? { banned } : {}),
      ...(fullName !== undefined ? { fullName } : {}),
      ...(role ? { role } : {}),
      ...(username !== undefined ? { username } : {}),
    })

    if (!updated) return jsonError('User not found', 404)
    return NextResponse.json({ user: serializeAdminUser(updated) })
  } catch (error) {
    return adminUserErrorResponse(error) ?? jsonError('Failed to update user', 500)
  }
})

/**
 * DELETE /api/admin/users
 * 管理员删除用户及其级联数据。
 * @param request - JSON `{ id }`
 */
export const DELETE = withAdmin(async (request, { userId: actorId }) => {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) return jsonError('Invalid JSON body')

  const id = toTrimmedString(body.id)
  if (!id) return jsonError('Missing or invalid "id" field')

  try {
    const result = await deleteAdminUserWithStorage(id, actorId)
    if (!result.found) return jsonError('User not found', 404)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UserStorageCleanupError) {
      return NextResponse.json({ error: error.message, ok: true }, { status: 502 })
    }
    return adminUserErrorResponse(error) ?? jsonError('Failed to delete user', 500)
  }
})
