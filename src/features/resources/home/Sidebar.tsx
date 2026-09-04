'use client'

import { ScrollShadow, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Suspense, memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import CategoryMenu from './Header/CategoryMenu'

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
    >
      <ScrollShadow className='h-full w-[240px]' size={2}>
        <Flex className='flex-col gap-px h-full'>
          <SideBarHeaderLayout
            breadcrumb={[
              {
                href: '/resources',
                title: '资源',
              },
            ]}
            homeHref='/'
            showHomeIcon
          />
          <Flex className='flex-col flex-1 gap-4 py-2 overflow-auto'>
            <Suspense fallback={null}>
              <CategoryMenu />
            </Suspense>
            {/* 知识库功能暂未开放 */}
          </Flex>
        </Flex>
      </ScrollShadow>
    </Flex>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
