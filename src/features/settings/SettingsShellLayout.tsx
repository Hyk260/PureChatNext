'use client'

import { Flex } from 'antd'
import { usePathname } from '@/utils/navigation'
import { type ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isProviderRoute = pathname.startsWith('/settings/provider')

  return (
    <MainShellLayout
      header={isProviderRoute ? undefined : <SettingsHeader />}
      sidebar={<SettingsSidebar />}
    >
      <Flex
        vertical
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
      </Flex>
    </MainShellLayout>
  )
}

export default SettingsShellLayout
