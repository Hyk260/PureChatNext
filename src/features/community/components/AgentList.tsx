'use client'

import { Grid } from '@pure/ui'
import { memo, useCallback, useMemo, useState } from 'react'

import type { DiscoverAgentItem } from '@/features/community/types'

import AgentCard from './AgentCard'
import AgentDetailModal from './AgentDetailModal'
import CommunityEmpty from './CommunityEmpty'

export interface AgentListProps {
  data?: DiscoverAgentItem[]
  rows?: number
}

const AgentList = memo<AgentListProps>(({ data = [], rows = 3 }) => {
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null)

  const selectedAgent = useMemo(
    () => data.find((item) => item.identifier === selectedIdentifier) ?? null,
    [data, selectedIdentifier]
  )

  const handleOpenDetail = useCallback((identifier: string) => {
    setSelectedIdentifier(identifier)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedIdentifier(null)
  }, [])

  if (data.length === 0) {
    return <CommunityEmpty description='试试调整分类或搜索关键词' title='暂无匹配助理' />
  }

  return (
    <>
      <Grid rows={rows} width='100%'>
        {data.map((item) => (
          <AgentCard key={item.identifier} {...item} onOpenDetail={handleOpenDetail} />
        ))}
      </Grid>
      <AgentDetailModal agent={selectedAgent} open={selectedIdentifier !== null} onClose={handleCloseDetail} />
    </>
  )
})

AgentList.displayName = 'AgentList'

export default AgentList
