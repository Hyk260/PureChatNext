'use client'

import { memo, useMemo } from 'react'

import { Flexbox } from '@pure/ui'
import AgentPagination from '@/features/community/components/AgentPagination'
import AgentSearch from '@/features/community/components/AgentSearch'
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
    <Flexbox horizontal gap={24} style={{ width: '100%' }}>
      <ModelCategory />
      <Flexbox flex={1} gap={16} style={{ minWidth: 0 }}>
        <AgentSearch placeholder='搜索名称介绍或关键词...' />
        <Flexbox gap={32} style={{ width: '100%' }}>
          <ModelList data={pageData} />
          <AgentPagination currentPage={currentPage} pageSize={PAGE_SIZE} total={total} />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
})

ModelPage.displayName = 'ModelPage'

export default ModelPage
