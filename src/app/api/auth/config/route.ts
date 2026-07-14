import { NextResponse } from 'next/server'

import { getAuthServerConfig } from '@/libs/better-auth/server'

// GET /api/auth/config
export async function GET() {
  return NextResponse.json(getAuthServerConfig())
}
