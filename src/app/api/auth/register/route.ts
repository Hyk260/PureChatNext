import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { logger } from '@/libs/logger'

/**
 * Legacy registration endpoint. Delegate account creation to Better Auth so
 * signup policy, verification, origin checks, and rate limits stay centralized.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }

    const target = new URL(request.url)
    target.pathname = '/api/auth/sign-up/email'
    const headers = new Headers(request.headers)
    headers.delete('content-length')
    headers.delete('transfer-encoding')
    headers.set('content-type', 'application/json')
    const authRequest = new Request(target, {
      body: JSON.stringify({
        email,
        name: email.split('@')[0],
        password,
        referralCode: body.referralCode,
        referralContext: body.referralContext,
      }),
      headers,
      method: 'POST',
    })
    const response = await auth.handler(authRequest)
    if (!response.ok) return response

    const result = (await response.clone().json().catch(() => null)) as {
      user?: { email?: string; userId?: string }
    } | null
    if (!result?.user) return response

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('content-length')
    responseHeaders.delete('transfer-encoding')
    responseHeaders.set('content-type', 'application/json')

    return Response.json(
      {
        message: '注册成功',
        code: 200,
        data: { email: result.user.email, userId: result.user.userId },
      },
      { headers: responseHeaders, status: response.status }
    )
  } catch (error) {
    logger.error(error, 'Register error:')
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
