'use client'

import { createStaticStyles, cssVar } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { memo } from 'react'

import SidebarBody from './SidebarBody'
import SidebarHeader from './SidebarHeader'
import SidebarNav from './SidebarNav'

const styles = createStaticStyles(({ css }) => ({
  sidebar: css`
    flex: none;
    width: 240px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    background: ${cssVar.colorBgLayout};
  `,
}))

const HomeSidebar = memo(() => {
  return (
    <Flex className={[styles.sidebar, 'flex-col h-full']}>
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
