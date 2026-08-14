import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { UserModel } from '@pure/database/models/user'
import { normalizeLoginIdentifier } from '@/libs/better-auth/shared'

export interface CheckUsernameResponseData {
  taken: boolean
}

/**
 * POST /api/auth/check-username
 * 只返回是否占用，不泄露邮箱等账户信息
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const username = typeof body.username === 'string' ? body.username : ''
    const identifier = normalizeLoginIdentifier(username)

    if (!identifier || identifier.kind !== 'username') {
      return NextResponse.json({ error: 'Invalid username', taken: false }, { status: 400 })
    }

    const existing = await UserModel.findByUsername(identifier.value)
    return NextResponse.json({ taken: Boolean(existing) } satisfies CheckUsernameResponseData)
  } catch (error) {
    console.error('Error checking username:', error)
    return NextResponse.json({ error: 'Internal server error', taken: false }, { status: 500 })
  }
}
