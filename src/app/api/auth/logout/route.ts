import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { RefreshTokenFamilyModel } from '@pure/database/models/refreshTokenFamily'
import { verifyRefreshToken } from '@/libs/auth/jwt'
import { clearRefreshTokenCookie, getRefreshTokenCookie } from '@/libs/auth/refreshTokenCookie'

/**
 * 登出接口
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: unknown } | null
  const refreshTokens = [body?.refreshToken, getRefreshTokenCookie(request)]
    .filter((token): token is string => typeof token === 'string' && token.length <= 8192)
    .filter((token, index, tokens) => tokens.indexOf(token) === index)

  for (const refreshToken of refreshTokens) {
    const verified = await verifyRefreshToken(refreshToken)
    if (verified.valid) {
      await new RefreshTokenFamilyModel().revoke({
        expiresAt: verified.expiresAt,
        familyId: verified.family,
        tokenId: verified.tokenId,
        userId: verified.userId,
      })
    }
  }

  return clearRefreshTokenCookie(NextResponse.json({ message: 'Logout successful' }), request)
}
