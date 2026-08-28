'use client'

import { memo, useMemo } from 'react'

import { Flex } from '@pure/ui'
import Scrollbar from '@/components/Scrollbar'
import AgentPagination from '@/features/community/components/AgentPagination'
import ModelCategory from '@/features/community/components/ModelCategory'
import ModelList from '@/features/community/components/ModelList'
import { COMMUNITY_MODELS, filterCommunityModels } from '@/const/community/models'
import { useSearchParams } from '@/utils/navigation'

const PAGE_SIZE = 21

const ModelPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')
  const pageParam = Number(searchParams.get('page')) || 1

  const data = useMemo(() => filterCommunityModels(COMMUNITY_MODELS, { category, q }), [category, q])

  const total = data.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, pageParam), totalPages)
  const pageData = useMemo(
    () => data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, data]
  )

  return (
    <Flex className='flex-row gap-6 h-full min-h-[0px] overflow-hidden w-full'>
      <ModelCategory />
      <Scrollbar
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
        viewStyle={{ paddingInlineEnd: 24 }}
        wrapClassName='community-scroll-viewport'
      >
        <Flex className='flex-col gap-8 w-full'>
          <ModelList data={pageData} />
          <AgentPagination currentPage={currentPage} pageSize={PAGE_SIZE} total={total} />
        </Flex>
      </Scrollbar>
    </Flex>
  )
})

ModelPage.displayName = 'ModelPage'

export default ModelPage
