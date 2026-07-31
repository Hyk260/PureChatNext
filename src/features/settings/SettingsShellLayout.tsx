'use client'

import { usePathname } from '@/utils/navigation'
import { Flexbox } from '@pure/ui'
import type { ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isProviderRoute = pathname.startsWith('/settings/provider')

  return (
    <MainShellLayout header={isProviderRoute ? undefined : <SettingsHeader />} sidebar={<SettingsSidebar />}>
      <Flexbox
        flex={1}
        style={{
          height: '100%',
          marginInline: isProviderRoute ? 0 : 'auto',
          maxWidth: isProviderRoute ? 'none' : 1024,
          minHeight: 0,
          overflow: isProviderRoute ? 'hidden' : 'auto',
          width: '100%',
        }}
      >
        {children}
      </Flexbox>
    </MainShellLayout>
  )
}

export default SettingsShellLayout
