'use client'

import { Flexbox } from '@lobehub/ui'
import { useSearchParams } from '@/utils/navigation'
import { memo, useMemo } from 'react'

import {
  COMMUNITY_AGENTS,
  filterCommunityAgents,
} from '@/const/community/agents'

import AgentCategory from './components/AgentCategory'
import AgentList from './components/AgentList'
import AgentSearch from './components/AgentSearch'

const AgentPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')

  const data = useMemo(
    () => filterCommunityAgents(COMMUNITY_AGENTS, { category, q }),
    [category, q],
  )

  return (
    <Flexbox horizontal gap={24} width='100%'>
      <AgentCategory />
      <Flexbox flex={1} gap={16} style={{ minWidth: 0 }}>
        <AgentSearch />
        <AgentList data={data} />
      </Flexbox>
    </Flexbox>
  )
})

AgentPage.displayName = 'AgentPage'

export default AgentPage
