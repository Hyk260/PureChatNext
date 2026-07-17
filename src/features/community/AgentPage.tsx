'use client'

import { Flexbox } from '@lobehub/ui'
import { memo, useMemo } from 'react'

import {
  COMMUNITY_AGENTS,
  filterCommunityAgents,
} from '@/const/community/agents'
import { useSearchParams } from '@/utils/navigation'

import AgentCategory from './components/AgentCategory'
import AgentList from './components/AgentList'
import AgentPagination from './components/AgentPagination'
import AgentSearch from './components/AgentSearch'

const PAGE_SIZE = 21

const AgentPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')
  const pageParam = Number(searchParams.get('page')) || 1

  const data = useMemo(
    () => filterCommunityAgents(COMMUNITY_AGENTS, { category, q }),
    [category, q],
  )

  const total = data.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, pageParam), totalPages)
  const pageData = useMemo(
    () => data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, data],
  )

  return (
    <Flexbox horizontal gap={24} width='100%'>
      <AgentCategory />
      <Flexbox flex={1} gap={16} style={{ minWidth: 0 }}>
        <AgentSearch />
        <Flexbox gap={32} width='100%'>
          <AgentList data={pageData} />
          <AgentPagination
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            total={total}
          />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
})

AgentPage.displayName = 'AgentPage'

export default AgentPage
