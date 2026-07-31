'use client'

import type { ReactNode } from 'react'

import { Flexbox } from '@pure/ui'
import MainShellLayout from '@/layout/MainShellLayout'

import CommunityHeader from './CommunityHeader'
import CommunitySidebar from './CommunitySidebar'

const CommunityShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <MainShellLayout header={<CommunityHeader />} sidebar={<CommunitySidebar />}>
      <Flexbox flex={1} id='community-scroll' style={{ padding: 24, overflow: 'auto', width: '100%' }}>
        {children}
      </Flexbox>
    </MainShellLayout>
  )
}

export default CommunityShellLayout
