import type { ReactNode } from 'react'

import AppShellLayout from '@/layout/AppShellLayout'
import ResourcesRootLayout from '@/routes/resources/_layout'

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <AppShellLayout>
      <ResourcesRootLayout>{children}</ResourcesRootLayout>
    </AppShellLayout>
  )
}

export default Layout
