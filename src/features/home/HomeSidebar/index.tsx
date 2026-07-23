'use client'

import { Flex } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
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
    <Flex vertical className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')} style={{ height: '100%', width: sidebarCollapsed ? 0 : 240 }}>
      <SidebarHeader />
      <Flex vertical flex={1} gap={1} style={{ minHeight: 0, width: 240 }}>
        <SidebarNav />
        <SidebarBody />
      </Flex>
    </Flex>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
