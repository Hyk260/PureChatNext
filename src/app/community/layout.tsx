import type { ReactNode } from 'react'

import AppShellLayout from '@/layout/AppShellLayout'
import CommunityLayout from '@/routes/community/_layout'

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <AppShellLayout>
      <CommunityLayout>{children}</CommunityLayout>
    </AppShellLayout>
  )
}

export default Layout
