'use client'

import { Flexbox } from '@lobehub/ui'
import { type ReactNode } from 'react'

import ProviderSettingsNav from '@/features/settings/provider/ProviderSettingsNav'
import SettingsHeader from '@/features/settings/SettingsHeader'

/** Provider settings split pane — shared by Next layout and SPA routes. */
export default function ProviderShellLayout({ children }: { children: ReactNode }) {
  return (
    <Flexbox
      height="100%"
      horizontal
      style={{ maxHeight: '100%', minHeight: 0, overflow: 'hidden' }}
      width="100%"
    >
      <ProviderSettingsNav />
      <Flexbox flex={1} height="100%" style={{ minWidth: 0 }} width="100%">
        <SettingsHeader />
        <Flexbox flex={1} style={{ minHeight: 0, overflow: 'auto' }} width="100%">
          {children}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
}
