'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'

import { Flex, ScrollArea } from '@pure/ui'
import { useSearchParams } from 'next/navigation'

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
    <Flex className='gap-6 h-full min-h-0 overflow-hidden w-full'>
      {sidebar}
      <ScrollArea className='min-h-0 min-w-0 flex-1' viewportClassName='community-scroll-viewport pe-6'>
        <Flex className='flex-col gap-8 w-full'>
          {children(pageData)}
          <CommunityPagination currentPage={currentPage} pageSize={pageSize} total={total} />
        </Flex>
      </ScrollArea>
    </Flex>
  )
}
