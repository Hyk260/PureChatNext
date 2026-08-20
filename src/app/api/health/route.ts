import { getChannelGatewaySummary } from '@/server/channel-gateway'
import { checkHealthDependencies } from '@/server/health/dependencies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const responseHeaders = {
  'Cache-Control': 'no-store',
}

function resolveHealthStatus(unhealthy: boolean, gatewayStatus: string) {
  if (unhealthy) return 'unhealthy'
  if (gatewayStatus === 'degraded') return 'degraded'
  return 'ok'
}

/**
 * GET /api/health
 * 健康检查：探测已配置的数据库、Redis、对象存储、搜索服务与渠道 Gateway 状态
 */
export async function GET() {
  try {
    const checks = await checkHealthDependencies()
    const gateway = getChannelGatewaySummary()
    const unhealthy = gateway.status === 'unhealthy' || Object.values(checks).some((status) => status === 'unhealthy')
    const degraded = gateway.status === 'degraded'

    return Response.json(
      { checks, gateway, status: resolveHealthStatus(unhealthy, degraded ? 'degraded' : gateway.status) },
      { headers: responseHeaders, status: unhealthy ? 503 : 200 }
    )
  } catch {
    return Response.json({ status: 'unhealthy' }, { headers: responseHeaders, status: 503 })
  }
}
