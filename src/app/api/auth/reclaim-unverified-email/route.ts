import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

import { serverDB } from '@pure/database/core/db-adaptor'
import { UserModel } from '@pure/database/models/user'
import { users } from '@pure/database/schemas/user'
import { logger } from '@/libs/logger'

export interface ReclaimUnverifiedEmailResponse {
  error?: string
  reclaimed: boolean
}

/**
 * POST /api/auth/reclaim-unverified-email
 * 删除未验证用户，释放邮箱以便重新注册。
 * 仅当用户存在且 emailVerified === false 时删除。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email is required', reclaimed: false } satisfies ReclaimUnverifiedEmailResponse,
        { status: 400 }
      )
    }

    const [user] = await serverDB
      .select({
        emailVerified: users.emailVerified,
        id: users.id,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found', reclaimed: false } satisfies ReclaimUnverifiedEmailResponse, {
        status: 404,
      })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        {
          error: 'Email is already verified',
          reclaimed: false,
        } satisfies ReclaimUnverifiedEmailResponse,
        { status: 409 }
      )
    }

    await UserModel.deleteUserByEmail(email)

    return NextResponse.json({ reclaimed: true } satisfies ReclaimUnverifiedEmailResponse)
  } catch (error) {
    logger.error(error, 'Reclaim unverified email error:')
    return NextResponse.json(
      { error: 'Internal server error', reclaimed: false } satisfies ReclaimUnverifiedEmailResponse,
      { status: 500 }
    )
  }
}
