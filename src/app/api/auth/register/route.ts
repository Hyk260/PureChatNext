import { NextResponse, type NextRequest } from 'next/server'
import { UserModel } from '@/database/models/user'
import { logger } from '@/libs/logger'

import { type User } from '@/database/schemas/user'

/**
 * 注册接口
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body as User

    if (!email || !password) {
      return NextResponse.json(
        {
          error: '邮箱和密码不能为空',
        },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少为 6 个字符' }, { status: 400 })
    }

    if (email) {
      const existingEmail = await UserModel.findByEmail(email)
      if (existingEmail) {
        return NextResponse.json(
          {
            error: '该邮箱已被注册',
          },
          { status: 400 }
        )
      }
    }

    // 创建用户
    const newUser = await UserModel.createUser({
      email,
      password,
    })

    return NextResponse.json(
      {
        message: '注册成功',
        code: 200,
        data: {
          email: newUser?.user?.email,
          userId: newUser?.user?.userId,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error(error, 'Register error:')
    return NextResponse.json(
      {
        error: '服务器内部错误',
      },
      { status: 500 }
    )
  }
}
