import { analyticsEnv } from '@/envs/analytics'
import { IS_VERCEL } from '@/envs/app'
import { renderSpaHtml } from '@/server/spaHtml'
import { type SPAServerConfig } from '@/types/spaServerConfig'

import spaHtmlTemplate from '../spaHtmlTemplate.generated'

export const dynamic = 'force-dynamic'

function buildServerConfig(): SPAServerConfig {
  return {
    renderedAt: new Date().toISOString(),
    enableVercelAnalytics: analyticsEnv.ENABLE_VERCEL_ANALYTICS,
    debugVercelAnalytics: analyticsEnv.DEBUG_VERCEL_ANALYTICS,
    enableSpeedInsights: IS_VERCEL,
    ...(analyticsEnv.REACT_SCAN_MONITOR_API_KEY
      ? { reactScanApiKey: analyticsEnv.REACT_SCAN_MONITOR_API_KEY }
      : {}),
  }
}

/**
 * Production SPA HTML shell.
 * Vite assets live under `/_spa/**`; this route injects `window.__SERVER_CONFIG__`
 * and returns the built `index.html`. Unmatched UI paths rewrite here (see next.config).
 *
 * Local UI development: use http://localhost:5174 — do not rely on this route or a Debug Proxy.
 */
export async function GET() {
  return renderSpaHtml(spaHtmlTemplate, {
    serverConfig: buildServerConfig(),
  })
}
