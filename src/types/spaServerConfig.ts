/**
 * Runtime config injected into the SPA HTML shell as `window.__SERVER_CONFIG__`.
 * Keep lean for phase 1; extend as client needs server-driven values.
 */
export type SPAServerConfig = {
  /** ISO timestamp when the shell was rendered (debug / deploy sanity). */
  renderedAt: string
  /** Mirrors `ENABLE_VERCEL_ANALYTICS` — SPA cannot read server env at runtime. */
  enableVercelAnalytics?: boolean
  debugVercelAnalytics?: boolean
  /** Mirrors Next root layout: enable when deployed on Vercel. */
  enableSpeedInsights?: boolean
}

declare global {
  interface Window {
    __SERVER_CONFIG__?: SPAServerConfig
  }
}

export {}
