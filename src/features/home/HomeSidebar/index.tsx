'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { Flex } from '@pure/ui'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

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
    transition: width 0.25s ${cssVar.motionEaseInOut};
  `,
  sidebarCollapsed: css`
    width: 0 !important;
  `,
}))

const HomeSidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flex className={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed, 'flex-col h-full']}>
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
