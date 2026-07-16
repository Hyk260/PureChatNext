import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { type ReactNode } from 'react'

import AppThemeProvider from './AppThemeProvider'

/**
 * Next App Router shell only.
 * SPA uses `src/spa/AppLayer.tsx` with `nuqs/adapters/react-router/v8`.
 */
const AppShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppThemeProvider>
      <NuqsAdapter>{children}</NuqsAdapter>
    </AppThemeProvider>
  )
}

export default AppShellLayout
