'use client'

import { Flex } from '@pure/ui'
import { memo } from 'react'

import SidebarBody from './SidebarBody'
import SidebarHeader from './SidebarHeader'
import SidebarNav from './SidebarNav'

const HomeSidebar = memo(() => {
  return (
    <Flex className='h-full w-[240px] min-w-0 flex-none flex-col overflow-hidden bg-app-layout'>
      <SidebarHeader />
      <Flex className='flex-col flex-1 gap-px min-h-[0px] w-[240px]'>
        <SidebarNav />
        <SidebarBody />
      </Flex>
    </Flex>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
