'use client'

import type { ReactNode } from 'react'

import { Flexbox } from '@pure/ui'
import MainShellLayout from '@/layout/MainShellLayout'

import CommunityHeader from './CommunityHeader'
import CommunitySidebar from './CommunitySidebar'

const CommunityShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <MainShellLayout header={<CommunityHeader />} scrollable={false} sidebar={<CommunitySidebar />}>
      <Flexbox
        flex={1}
        style={{
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          paddingBlock: 24,
          paddingInlineEnd: 0,
          paddingInlineStart: 24,
          width: '100%',
        }}
      >
        {children}
      </Flexbox>
    </MainShellLayout>
  )
}

export default CommunityShellLayout
