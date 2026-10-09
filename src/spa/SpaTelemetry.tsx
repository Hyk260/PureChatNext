import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights, computeRoute } from '@vercel/speed-insights/react'
import { useLocation, useParams } from 'react-router'

import { sanitizeReferralTelemetryUrl } from '@/libs/referrals/helpers'

import ReactScan from '@/components/Analytics/ReactScan'

/**
 * Vercel Analytics + Speed Insights for the Vite SPA.
 * Flags come from `window.__SERVER_CONFIG__` (injected by Next SPA shell).
 * Passes react-router location so client navigations emit pageviews / vitals routes.
 * Local `dev:spa` has no shell injection → no-op.
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
