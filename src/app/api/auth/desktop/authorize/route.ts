import { createHash, randomBytes } from 'node:crypto'

import { DesktopAuthCodeModel } from '@pure/database/models/desktopAuth'
import { UserModel } from '@pure/database/models/user'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import {
  DESKTOP_AUTH_CLIENT_ID,
  DESKTOP_AUTH_REDIRECT_URI,
  isDesktopAuthRedirectUri,
} from '@/const/desktopAuth'

const AUTH_CODE_TTL_MS = 60_000

const readString = (value: unknown) => (typeof value === 'string' ? value : '')

const isBase64Url = (value: string, minLength: number, maxLength: number) =>
  value.length >= minLength && value.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(value)

export async function POST(request: Request) {
  const requestHeaders = await headers()
  if (requestHeaders.get('authorization')) {
    return NextResponse.json({ error: '桌面授权必须在 Web 浏览器中完成' }, { status: 401 })
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录 Web 账号' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const clientId = readString(body?.client_id)
  const codeChallenge = readString(body?.code_challenge)
  const codeChallengeMethod = readString(body?.code_challenge_method)
  const redirectUri = readString(body?.redirect_uri)
  const state = readString(body?.state)

  if (
    clientId !== DESKTOP_AUTH_CLIENT_ID ||
    !isDesktopAuthRedirectUri(redirectUri) ||
    codeChallengeMethod !== 'S256' ||
    !isBase64Url(codeChallenge, 43, 128) ||
    !isBase64Url(state, 16, 256)
  ) {
    return NextResponse.json({ error: '桌面授权参数无效' }, { status: 400 })
  }

  const user = await new UserModel().findById(session.user.id)
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

  const code = randomBytes(32).toString('base64url')
  const codeHash = createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS)
  const model = new DesktopAuthCodeModel()

  await model.deleteExpired()
  await model.create({
    codeHash,
    clientId,
    codeChallenge,
    expiresAt,
    redirectUri,
    state,
    userId: user.id,
  })

  const callback = new URL(redirectUri)
  callback.searchParams.set('code', code)
  callback.searchParams.set('state', state)

  return NextResponse.json({ redirectUri: callback.toString() })
}
