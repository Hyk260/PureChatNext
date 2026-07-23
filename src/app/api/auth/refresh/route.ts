import { NextResponse, type NextRequest } from 'next/server'
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/libs/auth/jwt'
import debug from 'debug'

const log = debug('refresh-token')

/**
 * 刷新 Token 接口
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ error: 'refreshToken 不能为空' }, { status: 400 })
    }

    const verifyResult = await verifyRefreshToken(refreshToken)

    if (!verifyResult.valid) {
      return NextResponse.json(
        {
          error: verifyResult.expired ? '刷新令牌已过期' : '无效的刷新令牌',
        },
        { status: 401 }
      )
    }

    log('verifyResult: %O', verifyResult)

    if (!verifyResult.userId) {
      return NextResponse.json({ error: '令牌信息不完整' }, { status: 400 })
    }

    const accessToken = await signAccessToken(verifyResult.userId)
    const { token: newRefreshToken } = await signRefreshToken(verifyResult.userId)

    return NextResponse.json(
      {
        message: '刷新成功',
        code: 200,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    log('Refresh token error: %O', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
