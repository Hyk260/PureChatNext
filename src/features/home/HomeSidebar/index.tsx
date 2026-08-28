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
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    transition:
      width 0.25s ${cssVar.motionEaseInOut},
      border-color 0.25s ${cssVar.motionEaseInOut};
  `,
  sidebarCollapsed: css`
    width: 0 !important;
    border-inline-end-color: transparent;
  `,
}))

const HomeSidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flex
      className={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed, 'flex-col h-full']}
      style={{ width: sidebarCollapsed ? 0 : 240 }}
    >
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
