'use client'

import { Flex } from 'antd'
import { type ReactNode } from 'react'

import MainShellLayout from '@/layout/MainShellLayout'

import CommunityHeader from './CommunityHeader'
import CommunitySidebar from './CommunitySidebar'

const CommunityShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <MainShellLayout header={<CommunityHeader />} sidebar={<CommunitySidebar />}>
      <Flex vertical flex={1} id='community-scroll' style={{ padding: 24, overflow: 'auto', width: '100%' }}>
        {children}
      </Flex>
    </MainShellLayout>
  )
}

export default CommunityShellLayout
