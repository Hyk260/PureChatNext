'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'

import { Flex } from '@pure/ui'
import Scrollbar from '@/components/Scrollbar'
import { useSearchParams } from '@/utils/navigation'

import CommunityPagination from './CommunityPagination'
import { COMMUNITY_PAGE_SIZE } from '../constants'
import { getCommunityPageData } from '../pagination'

export interface CommunityCollectionPageProps<T> {
  children: (pageData: T[]) => ReactNode
  data: readonly T[]
  sidebar: ReactNode
  pageSize?: number
}

export function CommunityCollectionPage<T>({
  children,
  data,
  pageSize = COMMUNITY_PAGE_SIZE,
  sidebar,
}: CommunityCollectionPageProps<T>) {
  const searchParams = useSearchParams()
  const pageParam = Number(searchParams.get('page')) || 1
  const total = data.length
  const { currentPage, pageData } = useMemo(
    () => getCommunityPageData(data, pageParam, pageSize),
    [data, pageParam, pageSize]
  )

  return (
    <Flex className='flex-row gap-6 h-full min-h-[0px] overflow-hidden w-full'>
      {sidebar}
      <Scrollbar
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
        viewStyle={{ paddingInlineEnd: 24 }}
        wrapClassName='community-scroll-viewport'
      >
        <Flex className='flex-col gap-8 w-full'>
          {children(pageData)}
          <CommunityPagination currentPage={currentPage} pageSize={pageSize} total={total} />
        </Flex>
      </Scrollbar>
    </Flex>
  )
}
