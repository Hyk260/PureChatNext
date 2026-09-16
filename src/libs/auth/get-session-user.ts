import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { UserModel } from '@pure/database/models/user'
import { auth } from '@/auth'
import { isAdminRole } from '@/const/auth'

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null

  return new UserModel().findById(session.user.id)
}

export async function getAuthenticatedUserId() {
  const user = await getAuthenticatedUser()
  return user?.id ?? null
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export type AuthRouteContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>
  userId: string
}

type RouteContext<P extends Record<string, string>> = {
  params: Promise<P>
}

type AuthedRouteHandler<P extends Record<string, string>> = (
  request: NextRequest,
  context: AuthRouteContext<P>
) => Response | Promise<Response>

/**
 * App Router 鉴权包装器。
 * 校验 Better Auth session 后注入 `userId`；未登录返回 401 JSON。
 */
export function withAuth<P extends Record<string, string> = Record<string, string>>(handler: AuthedRouteHandler<P>) {
  return async (request: NextRequest, context?: RouteContext<P>) => {
    const userId = await getAuthenticatedUserId()
    if (!userId) return unauthorizedResponse()

    return handler(request, {
      params: context?.params ?? Promise.resolve({} as P),
      userId,
    })
  }
}

/**
 * App Router 管理员包装器。
 * 未登录 401；已登录但非 admin 403。以数据库 role 为准。
 */
export function withAdmin<P extends Record<string, string> = Record<string, string>>(handler: AuthedRouteHandler<P>) {
  return async (request: NextRequest, context?: RouteContext<P>) => {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()
    if (!isAdminRole(user.role)) return forbiddenResponse()

    return handler(request, {
      params: context?.params ?? Promise.resolve({} as P),
      userId: user.id,
    })
  }
}
