'use client'

import type { ReactNode } from 'react'

import DndContextWrapper from '@/features/resources/DndContextWrapper'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function ResourcesRootLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <DndContextWrapper>{children}</DndContextWrapper>
    </RequireAuth>
  )
}
