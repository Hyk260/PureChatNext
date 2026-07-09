'use client'

import { Flexbox } from '@lobehub/ui'
import { type ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import CommunityHeader from './CommunityHeader'
import CommunitySidebar from './CommunitySidebar'

const CommunityShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <MainShellLayout
      header={<CommunityHeader />}
      sidebar={<CommunitySidebar />}
    >
      <Flexbox flex={1} padding={24} style={{ overflow: 'auto' }} width='100%'>
        {children}
      </Flexbox>
    </MainShellLayout>
  )
}

export default CommunityShellLayout
