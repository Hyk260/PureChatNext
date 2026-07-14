'use client'

import { Flexbox } from '@lobehub/ui'
import { type ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import SettingsHeader from './SettingsHeader'
import SettingsSidebar from './SettingsSidebar'

const SettingsShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <MainShellLayout header={<SettingsHeader />} sidebar={<SettingsSidebar />}>
      <Flexbox
        flex={1}
        style={{ marginInline: 'auto', maxWidth: 1024, overflow: 'auto', width: '100%' }}
        width="100%"
      >
        {children}
      </Flexbox>
    </MainShellLayout>
  )
}

export default SettingsShellLayout
