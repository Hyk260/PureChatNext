import { NextResponse } from 'next/server'

import { getProviderEnvKeyFlags } from '@/libs/ai-providers/envKeys'

/**
 * GET /api/providers/config
 * 返回各服务商是否在服务端配置了 API Key（不含密钥本身）
 */
export async function GET() {
  return NextResponse.json({ envKeys: getProviderEnvKeyFlags() })
}
