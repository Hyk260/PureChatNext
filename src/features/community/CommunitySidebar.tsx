'use client'

import { Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import Scrollbar from '@/components/Scrollbar'
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
    transition: width 0.25s ${cssVar.motionEaseInOut};
  `,
  sidebarCollapsed: css`
    width: 0 !important;
  `,
}))

const CommunitySidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flex className={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed, 'flex-col h-full']}>
      <Scrollbar className='h-full w-[240px]'>
        <Flex className='flex-col gap-px h-full'>
          <CommunitySidebarHeader />
        </Flex>
      </Scrollbar>
    </Flex>
  )
})

CommunitySidebar.displayName = 'CommunitySidebar'

export default CommunitySidebar
