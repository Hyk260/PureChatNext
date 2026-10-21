'use client'

import { Flex } from '@pure/ui'
import { memo } from 'react'

import Scrollbar from '@/components/Scrollbar'

import CommunitySidebarHeader from './CommunitySidebarHeader'

const CommunitySidebar = memo(() => {
  return (
    <Flex className='size-full min-w-0 flex-none flex-col overflow-hidden bg-app-layout'>
      <Scrollbar className='size-full'>
        <Flex className='flex-col gap-px h-full'>
          <CommunitySidebarHeader />
        </Flex>
      </Scrollbar>
    </Flex>
  )
})

CommunitySidebar.displayName = 'CommunitySidebar'

export default CommunitySidebar
