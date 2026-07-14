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
    <SidebarModalProvider>
      <Flexbox
        className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')}
        height='100%'
        style={{ width: sidebarCollapsed ? 0 : 240 }}
      >
        <SidebarHeader />
        <ScrollShadow className={styles.scrollArea} size={2} style={{ width: 240 }}>
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
