'use client'

import { Flex } from '@pure/ui'
import type { ReactNode } from 'react'

import ProviderSettingsNav from '@/features/settings/provider/ProviderSettingsNav'
import Scrollbar from '@/components/Scrollbar'
import SettingsHeader from '@/features/settings/SettingsHeader'

/** Provider settings split pane — shared by Next layout and SPA routes. */
export default function ProviderShellLayout({ children }: { children: ReactNode }) {
  return (
    <Flex className='flex-row h-full max-h-[100vh] min-h-[0px] overflow-hidden w-full'>
      <ProviderSettingsNav />
      <Flex className='flex-col flex-1 h-full max-h-[100vh] min-w-[0px] w-full'>
        <SettingsHeader />
        <Scrollbar style={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%' }}>{children}</Scrollbar>
      </Flex>
    </Flex>
  )
}
