'use client'

import { memo, useMemo } from 'react'

import { Flexbox } from '@pure/ui'
import Scrollbar from '@/components/Scrollbar'
import { COMMUNITY_AGENTS, filterCommunityAgents } from '@/const/community/agents'
import { useSearchParams } from '@/utils/navigation'

import AgentCategory from './components/AgentCategory'
import AgentList from './components/AgentList'
import AgentPagination from './components/AgentPagination'

const PAGE_SIZE = 21

const AgentPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')
  const pageParam = Number(searchParams.get('page')) || 1

  const data = useMemo(() => filterCommunityAgents(COMMUNITY_AGENTS, { category, q }), [category, q])

  const total = data.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, pageParam), totalPages)
  const pageData = useMemo(
    () => data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, data]
  )

  return (
    <Flexbox horizontal gap={24} style={{ height: '100%', minHeight: 0, overflow: 'hidden', width: '100%' }}>
      <AgentCategory />
      <Scrollbar style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <Flexbox gap={32} style={{ width: '100%' }}>
          <AgentList data={pageData} />
          <AgentPagination currentPage={currentPage} pageSize={PAGE_SIZE} total={total} />
        </Flexbox>
      </Scrollbar>
    </Flexbox>
  )
})

AgentPage.displayName = 'AgentPage'

export default AgentPage
