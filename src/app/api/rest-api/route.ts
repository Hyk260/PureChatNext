import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAdminRole } from '@pure/const'
import { UserModel } from '@pure/database/models/user'
import { verifyAuth } from '@/libs/auth/middleware'
import { API_METHODS } from './handlers'
import debug from 'debug'

import type { ApiMethodName } from './types'

const log = debug('route:rest-api')

const methodNotAllowed = () => {
  return NextResponse.json(
    {
      success: false,
      error: 'Invalid function name',
      availableMethods: Object.keys(API_METHODS),
    },
    { status: 400 }
  )
}

const requireAdmin = async (request: NextRequest): Promise<NextResponse | null> => {
  const { user } = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const currentUser = await new UserModel().findByUserId(user.userId)
  if (!currentUser || !isAdminRole(currentUser.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return null
}

/**
 * POST /api/rest-api
 * 对外 REST 方法分发入口
 * @param request - JSON `{ funName, params }`（funName 见 availableMethods）
 */
export async function POST(request: NextRequest) {
  try {
    const authorizationError = await requireAdmin(request)
    if (authorizationError) return authorizationError

    const body = await request.json()
    const { funName, params } = body

    log('funName: %s, params: %o', funName, params)

    if (!funName || !(funName in API_METHODS)) {
      return methodNotAllowed()
    }

    const method = API_METHODS[funName as ApiMethodName]
    const result = await method(params)

    log('result: %o', result)

    return NextResponse.json({ success: true, result }, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log('error: %s', errorMessage)

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * GET /api/rest-api
 * 返回 REST API 可用方法列表
 */
export async function GET(request: NextRequest) {
  const authorizationError = await requireAdmin(request)
  if (authorizationError) return authorizationError

  return NextResponse.json(
    {
      message: 'REST API',
      availableMethods: Object.keys(API_METHODS),
    },
    { status: 200 }
  )
}
