'use client'

import { Flexbox } from '@lobehub/ui'
import type { ReactNode } from 'react'

import ProviderSettingsNav from '@/features/settings/provider/ProviderSettingsNav'
import SettingsHeader from '@/features/settings/SettingsHeader'

export default function ProviderLayout({ children }: { children: ReactNode }) {
  return (
    <Flexbox
      horizontal
      height='100%'
      width='100%'
      style={{ maxHeight: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      <ProviderSettingsNav />
      <Flexbox flex={1} height='100%' style={{ minWidth: 0 }} width='100%'>
        <SettingsHeader />
        <Flexbox flex={1} style={{ minHeight: 0, overflow: 'auto' }} width='100%'>
          {children}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
}
