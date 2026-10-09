import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ReferralRuleError } from '@pure/database/models/referral'
import { isAllowedOrigin } from '@/libs/utils/allowed-origins'
import { createCorsPreflightResponse, withCors } from '@/libs/utils/cors'

export const contextSchema = z.object({ context: z.string().min(1).max(2048) })
export const OPTIONS = createCorsPreflightResponse

export async function readBody<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ReferralRuleError('请使用 JSON 请求')
  const origin = request.headers.get('origin')
  if (origin && !isAllowedOrigin(origin)) throw new ReferralRuleError('请求来源不受信任', 403)
  const raw = await request.text()
  if (raw.length > 8192) throw new ReferralRuleError('请求内容过大', 413)
  try {
    return schema.parse(JSON.parse(raw))
  } catch {
    throw new ReferralRuleError('请求参数无效')
  }
}

export async function referralResponse(request: NextRequest, action: () => Promise<unknown>) {
  try {
    const response = NextResponse.json(await action())
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return withCors(request, response)
  } catch (error) {
    const known = error instanceof ReferralRuleError
    return withCors(
      request,
      NextResponse.json(
        { error: known ? error.message : '邀请服务暂时不可用，请稍后重试', code: known ? error.code : undefined },
        {
          status: known ? error.status : 503,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    )
  }
}
