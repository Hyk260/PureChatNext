'use client'

import type { ReactNode } from 'react'

import RequireAdmin from '@/spa/auth/RequireAdmin'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function AdminRouteLayout({ children }: { children?: ReactNode }) {
  return (
    <RequireAuth>
      <RequireAdmin>{children}</RequireAdmin>
    </RequireAuth>
  )
}
