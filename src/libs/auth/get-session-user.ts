import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import { UserModel } from '@pure/database/models/user'

export async function getAuthenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null

  const user = await UserModel.findById(session.user.id)
  return user?.id ?? null
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
