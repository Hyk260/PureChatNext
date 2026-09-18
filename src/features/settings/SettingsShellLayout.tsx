'use client'

import { usePathname } from 'next/navigation'
import { Flex } from '@pure/ui'
import type { ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isProviderRoute = pathname.startsWith('/settings/provider')
  const isSkillRoute = pathname.startsWith('/settings/skill')
  const isFullBleed = isProviderRoute || isSkillRoute

  return (
    <MainShellLayout
      header={isFullBleed ? undefined : <SettingsHeader />}
      scrollable={!isFullBleed}
      sidebar={<SettingsSidebar />}
    >
      <Flex
        className={[
          'flex-col flex-1 h-full min-h-[0px] w-full',
          isFullBleed ? 'm-0 max-w-none overflow-hidden' : 'mx-auto max-w-[1024px] overflow-auto',
        ]}
      >
        {children}
      </Flex>
    </MainShellLayout>
  )
}

export default SettingsShellLayout
