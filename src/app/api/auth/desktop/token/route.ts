import { createHash, timingSafeEqual } from 'node:crypto'

import { DesktopAuthCodeModel } from '@pure/database/models/desktopAuth'
import { UserModel } from '@pure/database/models/user'
import { NextResponse } from 'next/server'

import { DESKTOP_AUTH_CLIENT_ID, DESKTOP_AUTH_REDIRECT_URI } from '@/const/desktopAuth'
import { authEnv } from '@/envs/auth'
import { signAccessToken, signRefreshToken } from '@/libs/auth/jwt'

const ACCESS_TOKEN_EXPIRES_IN = (() => {
  const match = authEnv.JWT_ACCESS_EXPIRATION.match(/^(\d+)([smhd])$/i)
  if (!match) return 900
  return Number(match[1]) * { d: 86_400, h: 3_600, m: 60, s: 1 }[match[2].toLowerCase() as 'd' | 'h' | 'm' | 's']
})()

const constantTimeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const getError = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text())
  const clientId = form.get('client_id') ?? ''
  const code = form.get('code') ?? ''
  const codeVerifier = form.get('code_verifier') ?? ''
  const grantType = form.get('grant_type') ?? ''
  const redirectUri = form.get('redirect_uri') ?? ''

  if (
    clientId !== DESKTOP_AUTH_CLIENT_ID ||
    grantType !== 'authorization_code' ||
    redirectUri !== DESKTOP_AUTH_REDIRECT_URI ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier) ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(code)
  ) {
    return getError('授权兑换参数无效')
  }

  const codeHash = createHash('sha256').update(code).digest('hex')
  const model = new DesktopAuthCodeModel()
  const authorization = await model.findValid(codeHash)
  if (!authorization || authorization.clientId !== clientId || authorization.redirectUri !== redirectUri) {
    return getError('授权码无效、已过期或已使用', 400)
  }

  const challenge = createHash('sha256').update(codeVerifier).digest('base64url')
  if (!constantTimeEqual(challenge, authorization.codeChallenge)) return getError('PKCE 校验失败', 400)

  const consumed = await model.consume(codeHash)
  if (!consumed) return getError('授权码已使用或已过期', 400)

  const user = await new UserModel().findById(consumed.userId)
  if (!user) return getError('用户不存在', 404)

  const accessToken = await signAccessToken(user.userId, user.role ?? undefined)
  const { token: refreshToken } = await signRefreshToken(user.userId)

  return NextResponse.json({
    access_token: accessToken,
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
    refresh_token: refreshToken,
    token_type: 'Bearer',
  })
}
