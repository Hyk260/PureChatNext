'use client'

import { Flexbox, ScrollShadow } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

import SidebarBody from './SidebarBody'
import SidebarFooter from './SidebarFooter'
import SidebarHeader from './SidebarHeader'
import SidebarNav from './SidebarNav'
import { SidebarModalProvider } from './SidebarModalProvider'

const styles = createStaticStyles(({ css }) => ({
  scrollArea: css`
    flex: 1;
    min-height: 0;
  `,
  sidebar: css`
    flex: none;
    width: 240px;
    height: 100%;
    overflow: hidden;
    background: ${cssVar.colorBgLayout};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    transition: width 0.25s ${cssVar.motionEaseInOut};
  `,
  sidebarCollapsed: css`
    width: 0;
    overflow: hidden;
    border-inline-end: none;
  `,
}))

const HomeSidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <SidebarModalProvider>
      <Flexbox
        className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')}
        height='100%'
      >
        <SidebarHeader />
        <ScrollShadow className={styles.scrollArea} size={2}>
          <Flexbox gap={1} style={{ minHeight: '100%' }}>
            <SidebarNav />
            <SidebarBody />
          </Flexbox>
        </ScrollShadow>
        <SidebarFooter />
      </Flexbox>
    </SidebarModalProvider>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
