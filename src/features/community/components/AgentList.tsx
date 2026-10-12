'use client'

import { Grid, Text } from '@pure/ui'
import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react'

import type { DiscoverAgentSummary } from '@/features/community/types'

import AgentCard from './AgentCard'
import CommunityEmpty from './CommunityEmpty'

const AgentDetailModal = lazy(() => import('./AgentDetailModal'))

export interface AgentListProps {
  data?: DiscoverAgentSummary[]
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
      {selectedAgent ? (
        <Suspense fallback={<Text type='secondary'>正在加载助理详情…</Text>}>
          <AgentDetailModal agent={selectedAgent} open onClose={handleCloseDetail} />
        </Suspense>
      ) : null}
    </>
  )
})

AgentList.displayName = 'AgentList'

export default AgentList
