import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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

/**
 * REST API
 * POST /api/rest-api
 *
 * Request body:
 * {
 *   funName: "accountCheck" | "accountImport" | "restSendMsg" | "addGroupMember",
 *   params: AccountCheckItem[] | AccountImportParams | SendMsgParams | AddGroupMemberParams
 * }
 */
export async function POST(request: NextRequest) {
  try {
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
 * REST API
 * GET /api/rest-api
 */
export async function GET() {
  return NextResponse.json(
    {
      message: 'REST API',
      availableMethods: Object.keys(API_METHODS),
    },
    { status: 200 }
  )
}
