import { analyticsEnv } from '@/envs/analytics'
import { appEnv, IS_VERCEL } from '@/envs/app'
import { SITE_DEFAULT_URL } from '@/const/site'
import { isKnownSpaRoute } from '@/const/spaRouteManifest'
import { PUBLIC_SPA_FILTER_PARAMS } from '@/const/publicSpaMetadata'
import { getProviderEnvKeyFlags } from '@/libs/ai-providers/envKeys'
import { sanitizeReferralTelemetryUrl } from '@/libs/referrals/helpers'
import { renderSpaHtml } from '@/server/spaHtml'
import type { SPAServerConfig } from '@/types/spaServerConfig'

import type { NextRequest } from 'next/server'

import spaHtmlTemplate from '../spaHtmlTemplate.generated'

export const dynamic = 'force-dynamic'

function buildServerConfig(origin: string): SPAServerConfig {
  return {
    desktopCloudUrl: appEnv.PURECHAT_DESKTOP_CLOUD_URL ?? appEnv.APP_URL ?? origin,
    renderedAt: new Date().toISOString(),
    enableVercelAnalytics: analyticsEnv.ENABLE_VERCEL_ANALYTICS,
    debugVercelAnalytics: analyticsEnv.DEBUG_VERCEL_ANALYTICS,
    enableSpeedInsights: IS_VERCEL,
    providerEnvKeys: getProviderEnvKeyFlags(),
    ...(analyticsEnv.REACT_SCAN_MONITOR_API_KEY ? { reactScanApiKey: analyticsEnv.REACT_SCAN_MONITOR_API_KEY } : {}),
  }
}

/**
 * Production SPA HTML shell.
 * Vite assets live under `/_spa/**`; this route injects `window.__SERVER_CONFIG__`
 * and returns the built `index.html`. Unmatched UI paths rewrite here (see next.config).
 *
 * Local UI development: use http://localhost:5174 — do not rely on this route or a Debug Proxy.
 */
type SpaRouteContext = {
  params: Promise<{ path?: string[] }>
}

export async function GET(request: NextRequest, context: SpaRouteContext) {
  const { path = [] } = await context.params
  const pathname = path.length > 0 ? `/${path.map(encodeURIComponent).join('/')}` : '/'

  const response = renderSpaHtml(spaHtmlTemplate, {
    publicMetadata: {
      baseUrl: appEnv.SITE_CANONICAL_URL ?? appEnv.APP_URL ?? SITE_DEFAULT_URL,
      hasFilters: PUBLIC_SPA_FILTER_PARAMS.some((key) => request.nextUrl.searchParams.has(key)),
      pathname,
    },
    serverConfig: buildServerConfig(request.nextUrl.origin),
    status: isKnownSpaRoute(pathname) ? 200 : 404,
  })
  const url = request.nextUrl.toString()
  if (pathname === '/accept-referral' || sanitizeReferralTelemetryUrl(url) !== url) {
    response.headers.set('Referrer-Policy', 'no-referrer')
  }
  return response
}
