import { NextResponse } from 'next/server'
import { UserModel } from '@/database/models/user'
import { generateUserSig } from '@/libs/utils/signature'
import { generateAccessToken, generateRefreshToken } from '@/libs/jwt'

import type { User } from '@/database/schemas/user'
import type { NextRequest } from 'next/server';

/**
 * 登录接口
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, userId, password } = body as User

    if (!userId || !password) {
      return NextResponse.json({ error: '账号和密码不能为空' }, { status: 400 })
    }

    let user: User | null = null
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
    }
    if (userId) {
      user = await UserModel.findByUserIdAndPassword(userId, password)
      if (!user) {
        return NextResponse.json(
          {
            error: '账号或密码错误',
          },
          { status: 400 }
        )
      }
    }

    if (!user) {
      return NextResponse.json(
        {
          error: '用户不存在',
        },
        { status: 400 }
      )
    }

    const identifier = user.userId || userId || email || ''
    const userSig = generateUserSig({ identifier })
    const accessToken = await generateAccessToken(user.userId)
    const { token: refreshToken } = await generateRefreshToken(user.userId)

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
