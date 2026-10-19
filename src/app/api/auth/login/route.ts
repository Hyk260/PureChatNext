import { NextResponse } from 'next/server'
import { UserModel } from '@pure/database/models/user'
import { auth } from '@/auth'
import { isUserCurrentlyBanned } from '@/libs/auth/user-status'
import { signAccessToken } from '@/libs/auth/jwt'
import { issueRefreshToken } from '@/libs/auth/refreshTokenStore'
import { generateUserSig } from '@/libs/utils/signature'
import { setRefreshTokenCookie } from '@/libs/auth/refreshTokenCookie'

/**
 * Legacy login endpoint. Use Better Auth for credential verification so email
 * verification and account-ban rules cannot be bypassed by this compatibility route.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const password = typeof body?.password === 'string' ? body.password : ''
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''

    if (!password) return NextResponse.json({ error: '密码不能为空' }, { status: 400 })
    if (!email && !userId) return NextResponse.json({ error: '邮箱或账号不能为空' }, { status: 400 })

    const userModel = new UserModel()
    const account = userId ? await userModel.findByUserId(userId) : await userModel.findByEmail(email)
    const loginEmail = account?.email || email || 'legacy-unknown@invalid.example.com'

    const target = new URL(request.url)
    target.pathname = '/api/auth/sign-in/email'
    const headers = new Headers(request.headers)
    headers.delete('content-length')
    headers.delete('transfer-encoding')
    headers.set('content-type', 'application/json')
    const authRequest = new Request(target, {
      body: JSON.stringify({ email: loginEmail, password, rememberMe: true }),
      headers,
      method: 'POST',
    })
    const response = await auth.handler(authRequest)
    if (!response.ok) return response

    const result = (await response.clone().json().catch(() => null)) as {
      token?: string | null
      user?: { userId?: string }
    } | null
    const authenticatedUserId = result?.user?.userId
    if (!authenticatedUserId || !result?.token || isUserCurrentlyBanned(account)) return response

    const accessToken = await signAccessToken(authenticatedUserId)
    const { expiresAt, token: refreshToken } = await issueRefreshToken(authenticatedUserId)

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('content-length')
    responseHeaders.delete('transfer-encoding')
    responseHeaders.set('content-type', 'application/json')

    const tokenResponse = Response.json(
      {
        message: '登录成功',
        code: 200,
        data: {
          userId: authenticatedUserId,
          userSig: generateUserSig({ identifier: authenticatedUserId }),
          accessToken,
          refreshToken,
        },
      },
      { headers: responseHeaders, status: response.status }
    )
    return setRefreshTokenCookie(tokenResponse, request, refreshToken, expiresAt)
  } catch {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
