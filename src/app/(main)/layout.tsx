import type { ReactNode } from 'react'

import AppShellLayout from '@/layout/AppShellLayout'
import MainLayout from '@/routes/(main)/_layout'

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <AppShellLayout>
      <MainLayout>{children}</MainLayout>
    </AppShellLayout>
  )
}

export default Layout
