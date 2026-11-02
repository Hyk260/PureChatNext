import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { RefreshTokenFamilyModel } from '@pure/database/models/refreshTokenFamily'
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/libs/auth/jwt'
import { UserModel } from '@pure/database/models/user'
import { isUserCurrentlyBanned } from '@/libs/auth/user-status'
import { ACCESS_TOKEN_EXPIRES_IN } from '@/libs/auth/accessTokenExpiry'
import { getRefreshTokenCookie, setRefreshTokenCookie } from '@/libs/auth/refreshTokenCookie'
import debug from 'debug'

const log = debug('refresh-token')

/**
 * 刷新 Token 接口
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { refreshToken?: unknown } | null
    const refreshToken =
      typeof body?.refreshToken === 'string' ? body.refreshToken : getRefreshTokenCookie(request)

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

    const user = await new UserModel().findByUserId(verifyResult.userId)
    if (!user || isUserCurrentlyBanned(user)) {
      return NextResponse.json({ error: '账号不可用' }, { status: 401 })
    }

    const accessToken = await signAccessToken(verifyResult.userId)
    const nextRefresh = await signRefreshToken(verifyResult.userId, verifyResult.family)
    const rotated = await new RefreshTokenFamilyModel().rotate({
      expiresAt: nextRefresh.expiresAt,
      familyId: verifyResult.family,
      nextTokenId: nextRefresh.tokenId,
      previousTokenId: verifyResult.tokenId,
      userId: verifyResult.userId,
    })
    if (!rotated) {
      return NextResponse.json({ error: '刷新令牌已失效，请重新登录' }, { status: 401 })
    }

    const tokenResponse = NextResponse.json(
      {
        message: '刷新成功',
        code: 200,
        data: {
          accessToken,
          expiresIn: ACCESS_TOKEN_EXPIRES_IN,
          refreshToken: nextRefresh.token,
        },
      },
      { status: 200 }
    )
    return setRefreshTokenCookie(tokenResponse, request, nextRefresh.token, nextRefresh.expiresAt)
  } catch (error) {
    log('Refresh token error: %O', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
