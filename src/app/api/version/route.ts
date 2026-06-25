import { NextResponse } from 'next/server'
import pkg from '../../../../package.json'

/**
 * 获取当前版本
 * GET /api/version
 */
export async function GET() {
  return NextResponse.json({
    version: pkg.version,
  })
}
