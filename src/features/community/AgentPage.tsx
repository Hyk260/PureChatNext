'use client'

import { memo, useMemo } from 'react'

import { Flex } from '@pure/ui'
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
    <Flex className='flex-row gap-6 h-full min-h-[0px] overflow-hidden w-full'>
      <AgentCategory />
      <Scrollbar
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
        viewStyle={{ paddingInlineEnd: 24 }}
        wrapClassName='community-scroll-viewport'
      >
        <Flex className='flex-col gap-8 w-full'>
          <AgentList data={pageData} />
          <AgentPagination currentPage={currentPage} pageSize={PAGE_SIZE} total={total} />
        </Flex>
      </Scrollbar>
    </Flex>
  )
})

AgentPage.displayName = 'AgentPage'

export default AgentPage
