import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights, computeRoute } from '@vercel/speed-insights/react'
import { useLocation, useParams } from 'react-router'

import { sanitizeReferralTelemetryUrl } from '@/libs/referrals/helpers'

import ReactScan from '@/components/Analytics/ReactScan'

/**
 * 为 Vite SPA 提供 Vercel Analytics 和 Speed Insights。
 * 功能开关来自 `window.__SERVER_CONFIG__`（由 Next SPA 外壳注入）。
 * 传入 react-router 的位置信息，使客户端导航也能上报页面浏览和性能指标。
 * 本地运行 `dev:spa` 时没有外壳注入，因此不执行任何操作。
 */
const SpaTelemetry = () => {
  const config = typeof window !== 'undefined' ? window.__SERVER_CONFIG__ : undefined
  const { pathname, search } = useLocation()
  const params = useParams()

  const path = sanitizeReferralTelemetryUrl(`${pathname}${search}`)
  const sensitive = path !== `${pathname}${search}`
  const privacyMetadata = sensitive ? <meta name='referrer' content='no-referrer' /> : null

  if (!config?.enableVercelAnalytics && !config?.enableSpeedInsights && !config?.reactScanApiKey) {
    return privacyMetadata
  }

  const route = computeRoute(pathname, params as Record<string, string | string[]>) ?? pathname

  return (
    <>
      {privacyMetadata}
      {config.enableVercelAnalytics ? (
        <Analytics
          debug={config.debugVercelAnalytics}
          path={path}
          route={route}
          beforeSend={(event) => ({ ...event, url: sanitizeReferralTelemetryUrl(event.url) })}
        />
      ) : null}
      {config.enableSpeedInsights ? (
        <SpeedInsights
          route={route}
          beforeSend={(event) => ({ ...event, url: sanitizeReferralTelemetryUrl(event.url) })}
        />
      ) : null}
      {config.reactScanApiKey && !sensitive ? <ReactScan apiKey={config.reactScanApiKey} /> : null}
    </>
  )
}

export default SpaTelemetry
