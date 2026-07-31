import type { ReactNode } from 'react'

import HomeSidebar from '@/features/home/HomeSidebar'
import MainShellLayout from '@/layout/MainShellLayout'

/** SPA / shared main shell (home). */
export default function MainLayout({ children }: { children: ReactNode }) {
  return <MainShellLayout sidebar={<HomeSidebar />}>{children}</MainShellLayout>
}
