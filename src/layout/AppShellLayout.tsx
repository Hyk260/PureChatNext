import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { type ReactNode } from 'react'

import AppThemeProvider from './AppThemeProvider'

const AppShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppThemeProvider>
      <NuqsAdapter>{children}</NuqsAdapter>
    </AppThemeProvider>
  )
}

export default AppShellLayout
