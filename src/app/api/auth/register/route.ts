import { NextRequest, NextResponse } from 'next/server'
import { UserModel } from '@/database/models/user'
import { isValidEmail } from '@/utils'
import { logger } from '@/libs/logger'

import type { User } from '@/database/schemas/user'

/**
 * 注册接口
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, username: userId, password } = body as User

    if (!email || !userId || !password) {
      return NextResponse.json(
        {
          error: '邮箱、账号和密码不能为空',
        },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少为 6 个字符' }, { status: 400 })
    }

    // 仅允许小写字母和数字，长度 4-32
    if (!/^[a-z0-9]+$/.test(userId)) {
      return NextResponse.json(
        {
          error: '账号只能包含小写字母和数字',
        },
        { status: 400 }
      )
    }

    if (userId.length < 4 || userId.length > 32) {
      return NextResponse.json(
        {
          error: '账号长度必须在 4-32 个字符之间',
        },
        { status: 400 }
      )
    }

    if (userId) {
      const existingUser = await UserModel.findByUserId(userId)
      if (existingUser) {
        return NextResponse.json(
          {
            error: '该账号已被注册',
          },
          { status: 400 }
        )
      }
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
      userId,
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
