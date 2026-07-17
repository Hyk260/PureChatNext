import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { type PropsWithChildren, useLayoutEffect } from 'react'

import ThemeProviders from '@/layout/ThemeProviders'
import SpaTelemetry from '@/spa/SpaTelemetry'

/**
 * SPA global providers (Theme / URL state / telemetry).
 * Auth session via better-auth client hooks — no Provider required.
 * Extracted from the former Next App Router shell for Vite runtime.
 */
const AppLayer = ({ children }: PropsWithChildren) => {
  useLayoutEffect(() => {
    document.getElementById('loading-screen')?.remove()
  }, [])

  return (
    <ThemeProviders>
      <NuqsAdapter>
        {children}
        <SpaTelemetry />
      </NuqsAdapter>
    </ThemeProviders>
  )
}

export default AppLayer
