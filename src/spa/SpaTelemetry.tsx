import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights, computeRoute } from '@vercel/speed-insights/react'
import { useLocation, useParams } from 'react-router'

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

  if (!config?.enableVercelAnalytics && !config?.enableSpeedInsights) {
    return null
  }

  const path = `${pathname}${search}`
  const route = computeRoute(pathname, params as Record<string, string | string[]>) ?? pathname

  return (
    <>
      {config.enableVercelAnalytics ? (
        <Analytics debug={config.debugVercelAnalytics} path={path} route={route} />
      ) : null}
      {config.enableSpeedInsights ? <SpeedInsights route={route} /> : null}
    </>
  )
}

export default SpaTelemetry
