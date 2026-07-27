import { NextResponse, type NextRequest } from 'next/server'
import { UserModel } from '@pure/database/models/user'
import { generateUserSig } from '@/libs/utils/signature'
import { signAccessToken, signRefreshToken } from '@/libs/auth/jwt'

import { type UserWithoutPassword } from '@pure/database/schemas/user'

/**
 * 登录接口
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, userId, password } = body as {
      email?: string
      password?: string
      userId?: string
    }

    if (!password) {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 })
    }

    let user: UserWithoutPassword | null = null
    if (email) {
      user = await UserModel.findByEmailAndPassword(email, password)
      if (!user) {
        return NextResponse.json(
          {
            error: '邮箱或密码错误',
          },
          { status: 400 }
        )
      }
    } else if (userId) {
      user = await UserModel.findByUserIdAndPassword(userId, password)
      if (!user) {
        return NextResponse.json(
          {
            error: '账号或密码错误',
          },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json({ error: '邮箱或账号不能为空' }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json(
        {
          error: '用户不存在',
        },
        { status: 400 }
      )
    }

    const userSig = generateUserSig({ identifier: user.userId })
    const accessToken = await signAccessToken(user.userId)
    const { token: refreshToken } = await signRefreshToken(user.userId)

    const loginResponse = {
      message: '登录成功',
      code: 200,
      data: {
        userId: user.userId,
        userSig,
        accessToken,
        refreshToken,
      },
    }

    return NextResponse.json(loginResponse, { status: 200 })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
