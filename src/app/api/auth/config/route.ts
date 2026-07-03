import { NextResponse } from 'next/server'

import { getAuthServerConfig } from '@/libs/better-auth/get-auth-config'

// GET /api/auth/config
export async function GET() {
  return NextResponse.json(getAuthServerConfig())
}
