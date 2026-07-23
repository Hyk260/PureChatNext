import debug from 'debug'
import { NextResponse, type NextRequest } from 'next/server'
import { getGitHubSecretKey, type ClientType } from '@/libs/auth/gtihub'

const log = debug('auth:github')

/**
 * 获取 GitHub 授权地址
 * GET /api/auth/github?client=web|app
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const client = (searchParams.get('client') || 'web') as ClientType

    const { clientId } = getGitHubSecretKey(client)
    if (!clientId) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
    }

    const query: Record<string, string> = {
      client_id: clientId,
      scope: 'read:user user:email',
      // allow_signup: 'true',
    }

    const url = `https://github.com/login/oauth/authorize?${new URLSearchParams(query).toString()}`
    return NextResponse.json({ url }, { status: 200 })
  } catch (error) {
    log('GitHub authorize error: %O', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
