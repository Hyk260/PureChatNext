'use client'

import type { ReactNode } from 'react'

import SettingsShellLayout from '@/features/settings/SettingsShellLayout'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <SettingsShellLayout>{children}</SettingsShellLayout>
    </RequireAuth>
  )
}
