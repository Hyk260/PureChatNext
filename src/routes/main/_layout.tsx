'use client'

import type { ReactNode } from 'react'

import HomeSidebar from '@/features/home/HomeSidebar'
import MainShellLayout from '@/layout/MainShellLayout'
import RequireAuth from '@/spa/auth/RequireAuth'

/** SPA / shared main shell (home). */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <MainShellLayout scrollable={false} sidebar={<HomeSidebar />}>
        {children}
      </MainShellLayout>
    </RequireAuth>
  )
}
