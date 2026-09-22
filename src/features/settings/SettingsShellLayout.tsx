'use client'

import { usePathname } from 'next/navigation'
import { Flex } from '@pure/ui'
import type { ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const FULL_BLEED_PREFIXES = [
  '/settings/provider',
  '/settings/skill',
  '/settings/users',
  '/settings/web-search',
  '/settings/email-service',
]

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isFullBleed = FULL_BLEED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

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
