'use client'

import { Flexbox, ScrollShadow } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

import CommunitySidebarHeader from './CommunitySidebarHeader'

const styles = createStaticStyles(({ css }) => ({
  sidebar: css`
    flex: none;
    width: 240px;
    height: 100%;
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

const CommunitySidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flexbox
      className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')}
      height='100%'
    >
      <ScrollShadow size={2} style={{ height: '100%' }}>
        <Flexbox gap={1} height='100%' paddingBlock={4}>
          <CommunitySidebarHeader />
        </Flexbox>
      </ScrollShadow>
    </Flexbox>
  )
})

CommunitySidebar.displayName = 'CommunitySidebar'

export default CommunitySidebar
