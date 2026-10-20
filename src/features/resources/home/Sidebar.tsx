'use client'

import { Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from '@lobehub/ui'
import { Suspense, memo } from 'react'

import Scrollbar from '@/components/Scrollbar'
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
  `,
}))

const HomeSidebar = memo(() => {
  return (
    <Flex className={[styles.sidebar, 'flex-col h-full']}>
      <Scrollbar className='h-full w-[240px]'>
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
      </Scrollbar>
    </Flex>
  )
})

HomeSidebar.displayName = 'HomeSidebar'

export default HomeSidebar
