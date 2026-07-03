import { type ReactNode } from 'react'

import AppThemeProvider from './AppThemeProvider'

const AppShellLayout = ({ children }: { children: ReactNode }) => {
  return <AppThemeProvider>{children}</AppThemeProvider>
}

export default AppShellLayout
