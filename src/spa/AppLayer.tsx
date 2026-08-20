import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { useEffect, useLayoutEffect } from 'react'
import type { PropsWithChildren } from 'react'

import ThemeProviders from '@/layout/ThemeProviders'
import { captureAcquisitionAttribution } from '@/libs/analytics/acquisition'
import SpaTelemetry from '@/spa/SpaTelemetry'
import SpaUpdateNotifier from '@/spa/SpaUpdateNotifier'

/**
 * SPA global providers (Theme / URL state / telemetry).
 * Auth session via better-auth client hooks — no Provider required.
 * Extracted from the former Next App Router shell for Vite runtime.
 */
const AppLayer = ({ children }: PropsWithChildren) => {
  useLayoutEffect(() => {
    document.getElementById('loading-screen')?.remove()
  }, [])

  useEffect(() => {
    captureAcquisitionAttribution(window.location, document.referrer)
  }, [])

  return (
    <ThemeProviders>
      <NuqsAdapter>
        {children}
        <SpaTelemetry />
        <SpaUpdateNotifier />
      </NuqsAdapter>
    </ThemeProviders>
  )
}

export default AppLayer
