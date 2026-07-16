import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { type PropsWithChildren } from 'react'

import ThemeProviders from '@/layout/ThemeProviders'
import SpaTelemetry from '@/spa/SpaTelemetry'

/**
 * SPA global providers (Theme / URL state / telemetry).
 * Auth session via better-auth client hooks — no Provider required.
 * Extracted from Next `AppShellLayout` for Vite runtime.
 */
const AppLayer = ({ children }: PropsWithChildren) => {
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
