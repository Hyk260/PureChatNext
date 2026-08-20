import { NextResponse } from 'next/server'

import spaHtmlTemplate from '@/app/spa/spaHtmlTemplate.generated'
import { CURRENT_VERSION, extractSpaBuildTime } from '@/const/version'

/**
 * 获取当前版本与 SPA 构建指纹
 * GET /api/version
 */
export async function GET() {
  return NextResponse.json(
    {
      version: CURRENT_VERSION,
      buildTime: extractSpaBuildTime(spaHtmlTemplate),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
