'use client'

import type { ReactNode } from 'react'

import HomeSidebar from '@/features/home/HomeSidebar'
import MainShellLayout from '@/layout/MainShellLayout'
import RequireAuth from '@/spa/auth/RequireAuth'

/** SPA / 共享主框架（首页）。 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <MainShellLayout scrollable={false} sidebar={<HomeSidebar />}>
        {children}
      </MainShellLayout>
    </RequireAuth>
  )
}
