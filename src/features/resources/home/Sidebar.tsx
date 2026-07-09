'use client'

import { Flexbox, ScrollShadow } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import CategoryMenu from './Header/CategoryMenu'

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

const HomeSidebar = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flexbox
      className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')}
      height='100%'
    >
      <ScrollShadow size={2} style={{ height: '100%' }}>
        <Flexbox gap={1} height='100%' paddingBlock={4}>
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
          <Flexbox flex={1} gap={16} paddingBlock={8} style={{ overflow: 'auto' }}>
            <CategoryMenu />
            {/* 知识库功能暂未开放 */}
          </Flexbox>
        </Flexbox>
      </ScrollShadow>
    </Flexbox>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
