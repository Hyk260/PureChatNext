'use client'

import { usePathname } from '@/utils/navigation'
import { Flex } from '@pure/ui'
import type { ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isProviderRoute = pathname.startsWith('/settings/provider')

  return (
    <MainShellLayout
      header={isProviderRoute ? undefined : <SettingsHeader />}
      scrollable={!isProviderRoute}
      sidebar={<SettingsSidebar />}
    >
      <Flex
        className='flex-col flex-1 h-full min-h-[0px] w-full'

        style={{
          marginInline: isProviderRoute ? 0 : 'auto',
          maxWidth: isProviderRoute ? 'none' : 1024,
          overflow: isProviderRoute ? 'hidden' : 'auto',
        }}
      >
        {children}
      </Flex>
    </MainShellLayout>
  )
}

export default SettingsShellLayout
