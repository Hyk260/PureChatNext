import type { ReactNode } from 'react'

import HomeSidebar from '@/features/home/HomeSidebar'
import AppShellLayout from '@/layout/AppShellLayout'
import MainShellLayout from '@/layout/MainShellLayout'

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppShellLayout>
      <MainShellLayout sidebar={<HomeSidebar />}>{children}</MainShellLayout>
    </AppShellLayout>
  )
}

export default MainLayout
