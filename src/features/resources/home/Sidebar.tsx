'use client'

import { Flex } from '@pure/ui'
import { Suspense, memo } from 'react'

import Scrollbar from '@/components/Scrollbar'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import CategoryMenu from './Header/CategoryMenu'

const HomeSidebar = memo(() => {
  return (
    <Flex className='h-full w-[240px] min-w-0 flex-none flex-col overflow-hidden bg-app-layout'>
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
