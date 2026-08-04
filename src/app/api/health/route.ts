import { sql } from 'drizzle-orm'

import { serverDB } from '@pure/database/core/db-adaptor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const responseHeaders = {
  'Cache-Control': 'no-store',
}

export async function GET() {
  try {
    await serverDB.execute(sql`SELECT 1`)

    return Response.json({ status: 'ok' }, { headers: responseHeaders })
  } catch {
    return Response.json({ status: 'unhealthy' }, { headers: responseHeaders, status: 503 })
  }
}
