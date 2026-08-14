import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { UserModel } from '@pure/database/models/user'
import { normalizeLoginIdentifier } from '@/libs/better-auth/shared'

export interface CheckUserResponseData {
  email?: string | null
  emailVerified?: boolean
  exists: boolean
  hasPassword?: boolean
}

/**
 * POST /api/auth/check-user
 * 按邮箱或用户名检查账户是否存在
 * @param req - POST `{ email: string }`（字段名沿用，值可为邮箱或用户名）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email or username is required', exists: false }, { status: 400 })
    }

    const identifier = normalizeLoginIdentifier(email)
    if (!identifier) {
      return NextResponse.json({ error: 'Invalid email or username', exists: false }, { status: 400 })
    }

    const user =
      identifier.kind === 'email'
        ? await UserModel.findSignInCheck({ email: identifier.value })
        : await UserModel.findSignInCheck({ username: identifier.value })

    if (!user) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      email: user.email,
      emailVerified: user.emailVerified,
      exists: true,
      hasPassword: user.hasPassword,
    } satisfies CheckUserResponseData)
  } catch (error) {
    console.error('Error checking user existence:', error)
    return NextResponse.json({ error: 'Internal server error', exists: false }, { status: 500 })
  }
}
