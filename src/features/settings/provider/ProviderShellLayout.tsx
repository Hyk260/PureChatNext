'use client'

import { Flexbox } from '@pure/ui'
import type { ReactNode } from 'react'

import ProviderSettingsNav from '@/features/settings/provider/ProviderSettingsNav'
import SettingsHeader from '@/features/settings/SettingsHeader'

/** Provider settings split pane — shared by Next layout and SPA routes. */
export default function ProviderShellLayout({ children }: { children: ReactNode }) {
  return (
    <Flexbox horizontal height='100%' style={{ maxHeight: '100vh', minHeight: 0, overflow: 'hidden' }} width='100%'>
      <ProviderSettingsNav />
      <Flexbox flex={1} height='100%' style={{ maxHeight: '100vh', minWidth: 0 }} width='100%'>
        <SettingsHeader />
        <Flexbox flex={1} style={{ minHeight: 0, overflow: 'auto' }} width='100%'>
          {children}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
}
