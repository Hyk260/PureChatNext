'use client'

import { Flex } from 'antd'
import { ScrollShadow } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

import CommunitySidebarHeader from './CommunitySidebarHeader'

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

const CommunitySidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flex vertical className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')} style={{ height: '100%', width: sidebarCollapsed ? 0 : 240 }}>
      <ScrollShadow size={2} style={{ height: '100%', width: 240 }}>
        <Flex vertical gap={1} style={{ height: '100%', paddingBlock: 4 }}>
          <CommunitySidebarHeader />
        </Flex>
      </ScrollShadow>
    </Flex>
  )
})

CommunitySidebar.displayName = 'CommunitySidebar'

export default CommunitySidebar
