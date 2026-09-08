'use client'

import { memo, useEffect, useMemo } from 'react'

import { COMMUNITY_AGENTS, filterCommunityAgents } from '@/const/community/agents'
import { filterCustomAgents } from '@/features/community/customAgents'
import { AssistantCategory } from '@/features/community/types'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useSearchParams } from '@/utils/navigation'

import AgentCategory from './components/AgentCategory'
import { CommunityCollectionPage } from './components/CommunityCollectionPage'
import AgentList from './components/AgentList'
import CustomAgentList from './components/CustomAgentList'

const AgentPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')
  const isCustom = category === AssistantCategory.Custom

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  const marketData = useMemo(() => filterCommunityAgents(COMMUNITY_AGENTS, { category, q }), [category, q])
  const customData = useMemo(() => filterCustomAgents(agents, q), [agents, q])

  if (isCustom) {
    return (
      <CommunityCollectionPage data={customData} sidebar={<AgentCategory />}>
        {(pageData) => <CustomAgentList data={pageData} />}
      </CommunityCollectionPage>
    )
  }

  return (
    <CommunityCollectionPage data={marketData} sidebar={<AgentCategory />}>
      {(pageData) => <AgentList data={pageData} />}
    </CommunityCollectionPage>
  )
})

AgentPage.displayName = 'AgentPage'

export default AgentPage
