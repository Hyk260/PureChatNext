'use client'

import { memo, useMemo } from 'react'

import { COMMUNITY_AGENTS, filterCommunityAgents } from '@/const/community/agents'
import { useSearchParams } from '@/utils/navigation'

import AgentCategory from './components/AgentCategory'
import { CommunityCollectionPage } from './components/CommunityCollectionPage'
import AgentList from './components/AgentList'

const AgentPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')

  const data = useMemo(() => filterCommunityAgents(COMMUNITY_AGENTS, { category, q }), [category, q])

  return (
    <CommunityCollectionPage data={data} sidebar={<AgentCategory />}>
      {(pageData) => <AgentList data={pageData} />}
    </CommunityCollectionPage>
  )
})

AgentPage.displayName = 'AgentPage'

export default AgentPage
