'use client'

import { Center, Grid, Text } from '@pure/ui'
import { memo, useCallback, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import type { AgentListItem } from '@/const/home/agents'
import { toDiscoverAgentFromListItem } from '@/features/community/customAgents'
import { toActiveCommunityAgent } from '@/features/community/toActiveCommunityAgent'
import { updateAgent } from '@/features/home/agentApi'
import AgentFormModal from '@/features/home/HomeSidebar/modals/AgentFormModal'
import type { AgentFormValues } from '@/features/home/HomeSidebar/modals/AgentFormModal'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useRouter } from '@/utils/navigation'

import AgentDetailModal from './AgentDetailModal'
import CommunityEmpty from './CommunityEmpty'
import CustomAgentCard from './CustomAgentCard'

export interface CustomAgentListProps {
  data?: AgentListItem[]
  rows?: number
}

const CustomAgentList = memo<CustomAgentListProps>(({ data = [], rows = 3 }) => {
  const { message } = useApp()
  const router = useRouter()
  const [editing, setEditing] = useState<AgentListItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null)

  const loaded = useAgentsStore((s) => s.loaded)
  const error = useAgentsStore((s) => s.error)
  const upsertLocal = useAgentsStore((s) => s.upsertLocal)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  const detailAgent = useMemo(
    () => data.find((item) => item.id === detailAgentId) ?? null,
    [data, detailAgentId]
  )
  const detailDiscoverAgent = useMemo(
    () => (detailAgent ? toDiscoverAgentFromListItem(detailAgent) : null),
    [detailAgent]
  )

  const handleOpenDetail = useCallback((id: string) => {
    setDetailAgentId(id)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailAgentId(null)
  }, [])

  const handleUse = useCallback(
    (agent: AgentListItem) => {
      setSelectedAgentId(agent.id)
      setActiveAgent(toActiveCommunityAgent(agent))
      router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
    },
    [router, setActiveAgent, setSelectedAgentId]
  )

  const handleEdit = useCallback(
    async (values: AgentFormValues) => {
      if (!editing) return
      setSaving(true)
      try {
        const agent = await updateAgent(editing.id, values)
        upsertLocal(agent)
        if (selectedAgentId === agent.id) {
          setActiveAgent(toActiveCommunityAgent(agent))
        }
        setEditing(null)
        message.success('已保存')
      } catch (editError) {
        console.error('[community] update custom agent failed:', editError)
        message.error('保存失败')
      } finally {
        setSaving(false)
      }
    },
    [editing, message, selectedAgentId, setActiveAgent, upsertLocal]
  )

  const handleEditFromDetail = useCallback(() => {
    if (!detailAgent) return
    setDetailAgentId(null)
    setEditing(detailAgent)
  }, [detailAgent])

  const handleUseFromDetail = useCallback(() => {
    if (!detailAgent) return
    handleUse(detailAgent)
  }, [detailAgent, handleUse])

  if (!loaded && !error && data.length === 0) {
    return (
      <Center className='min-h-[50vh] w-full'>
        <Text type='secondary'>加载中…</Text>
      </Center>
    )
  }

  if (data.length === 0) {
    return <CommunityEmpty description='点击右上角创建，打造你自己的助理' title='还没有自定义助理' />
  }

  return (
    <>
      <Grid rows={rows} width='100%'>
        {data.map((agent) => (
          <CustomAgentCard
            key={agent.id}
            agent={agent}
            onEdit={setEditing}
            onOpenDetail={handleOpenDetail}
            onUse={handleUse}
          />
        ))}
      </Grid>
      <AgentDetailModal
        agent={detailDiscoverAgent}
        open={detailAgentId !== null}
        onClose={handleCloseDetail}
        onEdit={handleEditFromDetail}
        onUse={handleUseFromDetail}
      />
      <AgentFormModal
        agent={editing}
        confirmLoading={saving}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onSubmit={handleEdit}
      />
    </>
  )
})

CustomAgentList.displayName = 'CustomAgentList'

export default CustomAgentList
