import type { ReactNode } from 'react'

import AppShellLayout from '@/layout/AppShellLayout'
import SettingsLayout from '@/routes/settings/_layout'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AppShellLayout>
      <SettingsLayout>{children}</SettingsLayout>
    </AppShellLayout>
  )
}
