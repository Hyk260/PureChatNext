'use client'

import type { ReactNode } from 'react'

import { Flex } from '@pure/ui'
import MainShellLayout from '@/layout/MainShellLayout'

import CommunityHeader from './CommunityHeader'
import CommunitySidebar from './CommunitySidebar'

const CommunityShellLayout = ({ children }: { children: ReactNode }) => {
  return (
    <MainShellLayout header={<CommunityHeader />} scrollable={false} sidebar={<CommunitySidebar />}>
      <Flex className='flex-col flex-1 size-full min-h-[0px] overflow-hidden py-6 pe-0 ps-6'>{children}</Flex>
    </MainShellLayout>
  )
}

export default CommunityShellLayout
