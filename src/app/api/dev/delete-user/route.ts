import { NextResponse } from 'next/server'

import { isRecord, toTrimmedString } from '@pure/utils/object'
import { UserModel } from '@pure/database/models/user'
import { devActionSuccess, devError, getErrorMessage } from '../_utils'

type DeleteUserAction = 'lookup' | 'delete'

const availableActions: DeleteUserAction[] = ['lookup', 'delete']

const parseEmail = (value: unknown) => {
  const email = toTrimmedString(value)
  return email?.includes('@') ? email : undefined
}

/**
 * 用户删除测试 API（仅开发环境）
 * POST /api/dev/delete-user
 */
export const POST = async (req: Request) => {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return devError('Invalid JSON body')
  }

  if (!isRecord(body)) {
    return devError('Request body must be an object')
  }

  const rawAction = body.action

  if (typeof rawAction !== 'string' || !availableActions.includes(rawAction as DeleteUserAction)) {
    return devError(`Invalid action. Available actions: ${availableActions.join(', ')}`)
  }

  const action = rawAction as DeleteUserAction
  const email = parseEmail(body.email)

  if (!email) {
    return devError('Missing or invalid "email" field')
  }

  try {
    if (action === 'lookup') {
      const result = await UserModel.getUserDeletionPreview(email)

      return devActionSuccess(action, result)
    }

    const confirmEmail = parseEmail(body.confirmEmail)

    if (!confirmEmail) {
      return devError('Missing or invalid "confirmEmail" field')
    }

    if (confirmEmail !== email) {
      return devError('confirmEmail must match email')
    }

    const result = await UserModel.deleteUserByEmail(email)

    return devActionSuccess(action, result)
  } catch (error) {
    const message = getErrorMessage(error)

    return devError(message, 500)
  }
}

/**
 * 用户删除测试 API（仅开发环境）
 * GET /api/dev/delete-user
 */
export const GET = async () => {
  return NextResponse.json(
    {
      actions: availableActions,
      message: 'Delete user API',
    },
    { status: 200 }
  )
}
