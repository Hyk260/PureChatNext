'use client'

import { ActionIcon, Flex } from '@pure/ui'
import { PanelLeftOpen } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const HEADERLESS_PREFIXES = [
  '/settings/users',
  '/settings/web-search',
  '/settings/email-service',
  '/settings/read-file',
  '/settings/s3',
]

const FULL_BLEED_PREFIXES = ['/settings/provider', '/settings/skill', ...HEADERLESS_PREFIXES]

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)
  const isFullBleed = FULL_BLEED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const showExpand =
    sidebarCollapsed && HEADERLESS_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  return (
    <MainShellLayout
      header={isFullBleed ? undefined : <SettingsHeader />}
      scrollable={!isFullBleed}
      sidebar={<SettingsSidebar />}
    >
      <Flex
        className={[
          'relative flex-col flex-1 h-full min-h-[0px] w-full',
          isFullBleed ? 'm-0 max-w-none overflow-hidden' : 'mx-auto max-w-[1024px] overflow-auto',
        ]}
      >
        {showExpand ? (
          <div className='absolute start-2 top-2 z-10'>
            <ActionIcon
              icon={PanelLeftOpen}
              size='small'
              title='展开侧栏'
              onClick={toggleSidebarCollapsed}
            />
          </div>
        ) : null}
        {children}
      </Flex>
    </MainShellLayout>
  )
}

export default SettingsShellLayout
