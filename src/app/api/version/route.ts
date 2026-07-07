import { NextResponse } from 'next/server'
import { CURRENT_VERSION } from '@/const/version'

/**
 * 获取当前版本
 * GET /api/version
 */
export async function GET() {
  return NextResponse.json({
    version: CURRENT_VERSION,
  })
}
