'use client'

import { Grid } from '@pure/ui'
import { memo } from 'react'

import type { DiscoverAgentItem } from '@/features/community/types'

import AgentCard from './AgentCard'
import CommunityEmpty from './CommunityEmpty'

export interface AgentListProps {
  data?: DiscoverAgentItem[]
  rows?: number
}

const AgentList = memo<AgentListProps>(({ data = [], rows = 3 }) => {
  if (data.length === 0) {
    return <CommunityEmpty description='试试调整分类或搜索关键词' title='暂无匹配助理' />
  }

  return (
    <Grid rows={rows} width='100%'>
      {data.map((item) => (
        <AgentCard key={item.identifier} {...item} />
      ))}
    </Grid>
  )
})

AgentList.displayName = 'AgentList'

export default AgentList
