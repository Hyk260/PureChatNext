'use client'

import { Grid } from '@lobehub/ui'
import { memo } from 'react'

import type { DiscoverAgentItem } from '@/features/community/types'

import AgentCard from './AgentCard'
import AgentEmpty from './AgentEmpty'

export interface AgentListProps {
  data?: DiscoverAgentItem[]
  rows?: number
}

const AgentList = memo<AgentListProps>(({ data = [], rows = 3 }) => {
  if (data.length === 0) return <AgentEmpty />

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
