import { type ReactNode } from 'react'

import SettingsShellLayout from '@/features/settings/SettingsShellLayout'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsShellLayout>{children}</SettingsShellLayout>
}
