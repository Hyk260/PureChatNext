import { sql } from 'drizzle-orm'

import { serverDB } from '@pure/database/core/db-adaptor'
import { getChannelGatewaySummary } from '@/server/channel-gateway'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const responseHeaders = {
  'Cache-Control': 'no-store',
}

/**
 * GET /api/health
 * 健康检查：探测数据库连通性与渠道 Gateway 状态
 */
export async function GET() {
  try {
    await serverDB.execute(sql`SELECT 1`)
    const gateway = getChannelGatewaySummary()
    const unhealthy = gateway.status === 'unhealthy'

    return Response.json(
      { gateway, status: unhealthy ? 'unhealthy' : gateway.status === 'degraded' ? 'degraded' : 'ok' },
      { headers: responseHeaders, status: unhealthy ? 503 : 200 }
    )
  } catch {
    return Response.json({ status: 'unhealthy' }, { headers: responseHeaders, status: 503 })
  }
}
