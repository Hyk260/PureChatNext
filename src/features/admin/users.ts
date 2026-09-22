import { USER_ROLE } from '@pure/const'
import type { UserRole } from '@pure/const'

import { apiFetch, jsonInit } from '@/utils/apiFetch'

export type AdminUserSortBy = 'lastActiveAt' | 'role'

export type AdminUserCredits = {
  grant: number
  remaining: number
}

export type AdminUser = {
  banned: boolean
  banReason: string | null
  createdAt: string
  credits?: AdminUserCredits
  email: string | null
  emailVerified: boolean
  fullName: string | null
  id: string
  lastActiveAt: string
  role: string | null
  userId: string
  username: string | null
}

export type AdminUsersListResponse = {
  items: AdminUser[]
  page: number
  pageSize: number
  total: number
}

export type CreateAdminUserInput = {
  email: string
  password: string
  role: UserRole
  username?: string
}

export type UpdateAdminUserInput = {
  banReason?: string | null
  banned?: boolean
  fullName?: string | null
  id: string
  role?: UserRole
  username?: string
}

export const ADMIN_ROLE_OPTIONS = [
  { label: '普通用户', value: USER_ROLE.User },
  { label: '管理员', value: USER_ROLE.Admin },
] as const

type ErrorPayload = {
  error?: string
}

const readError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null
  return payload?.error || fallback
}

export async function fetchAdminUsers(
  params: { page: number; pageSize: number; q: string; sortBy?: AdminUserSortBy; sortOrder?: 'asc' | 'desc' },
  signal?: AbortSignal
) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.q) search.set('q', params.q)
  if (params.sortBy) {
    search.set('sortBy', params.sortBy)
    search.set('sortOrder', params.sortOrder ?? 'desc')
  }

  const response = await apiFetch(`/api/admin/users?${search}`, { signal })
  if (!response.ok) throw new Error(await readError(response, '加载用户失败'))
  return (await response.json()) as AdminUsersListResponse
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const response = await apiFetch('/api/admin/users', jsonInit(input, { method: 'POST' }))
  if (!response.ok) throw new Error(await readError(response, '创建用户失败'))
  const payload = (await response.json()) as { user: AdminUser }
  return payload.user
}

export async function updateAdminUser(input: UpdateAdminUserInput) {
  const response = await apiFetch('/api/admin/users', jsonInit(input, { method: 'PATCH' }))
  if (!response.ok) throw new Error(await readError(response, '更新用户失败'))
  const payload = (await response.json()) as { user: AdminUser }
  return payload.user
}

export async function deleteAdminUser(id: string) {
  const response = await apiFetch('/api/admin/users', jsonInit({ id }, { method: 'DELETE' }))
  if (!response.ok) throw new Error(await readError(response, '删除用户失败'))
}
