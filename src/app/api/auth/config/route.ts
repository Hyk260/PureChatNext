import { NextResponse } from 'next/server'

import { getAuthServerConfig } from '@/libs/better-auth/server'

/**
 * GET /api/auth/config
 * 返回前端可用的认证服务端配置（不含密钥）
 */
export async function GET() {
  return NextResponse.json(getAuthServerConfig())
}
