'use client'

import { ScrollShadow, Flexbox } from '@pure/ui'
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
    <Flexbox
      className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')}
      style={{ height: '100%', width: sidebarCollapsed ? 0 : 240 }}
    >
      <ScrollShadow size={2} style={{ height: '100%', width: 240 }}>
        <Flexbox gap={1} style={{ height: '100%', paddingBlock: 4 }}>
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
          <Flexbox flex={1} gap={16} style={{ paddingBlock: 8, overflow: 'auto' }}>
            <Suspense fallback={null}>
              <CategoryMenu />
            </Suspense>
            {/* 知识库功能暂未开放 */}
          </Flexbox>
        </Flexbox>
      </ScrollShadow>
    </Flexbox>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
