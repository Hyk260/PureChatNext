import type { ReactNode } from 'react'

import SettingsShellLayout from '@/features/settings/SettingsShellLayout'
import AppShellLayout from '@/layout/AppShellLayout'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellLayout>
      <SettingsShellLayout>{children}</SettingsShellLayout>
    </AppShellLayout>
  )
}
