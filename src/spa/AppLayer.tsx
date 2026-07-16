import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { type PropsWithChildren } from 'react'

import ThemeProviders from '@/layout/ThemeProviders'

/**
 * SPA global providers (Theme / URL state).
 * Auth session via better-auth client hooks — no Provider required.
 * Extracted from Next `AppShellLayout` for Vite runtime.
 */
const AppLayer = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProviders>
      <NuqsAdapter>{children}</NuqsAdapter>
    </ThemeProviders>
  )
}

export default AppLayer
