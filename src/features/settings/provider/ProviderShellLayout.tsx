'use client'

import { Flex } from 'antd'
import { type ReactNode } from 'react'

import ProviderSettingsNav from '@/features/settings/provider/ProviderSettingsNav'
import SettingsHeader from '@/features/settings/SettingsHeader'

/** Provider settings split pane — shared by Next layout and SPA routes. */
export default function ProviderShellLayout({ children }: { children: ReactNode }) {
  return (
    <Flex style={{ height: "100%", maxHeight: '100%', minHeight: 0, overflow: 'hidden', width: "100%" }}>
      <ProviderSettingsNav />
      <Flex vertical flex={1} style={{ height: "100%", minWidth: 0, width: "100%" }}>
        <SettingsHeader />
        <Flex vertical flex={1} style={{ minHeight: 0, overflow: 'auto', width: "100%" }}>
          {children}
        </Flex>
      </Flex>
    </Flex>
  )
}
