'use client'

import { Center, confirmModal, Grid, Text } from '@pure/ui'
import { memo, useCallback, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import type { AgentListItem } from '@/const/home/agents'
import { toDiscoverAgentFromListItem } from '@/features/community/customAgents'
import { toActiveCommunityAgent } from '@/features/community/toActiveCommunityAgent'
import { deleteAgent, updateAgent } from '@/features/home/agentApi'
import AgentFormModal from '@/features/home/HomeSidebar/modals/AgentFormModal'
import type { AgentFormValues } from '@/features/home/HomeSidebar/modals/AgentFormModal'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useRouter } from 'next/navigation'

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
  const removeLocal = useAgentsStore((s) => s.removeLocal)
  const agents = useAgentsStore((s) => s.agents)
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

  const handleDelete = useCallback(
    (agent: AgentListItem) => {
      confirmModal({
        cancelText: '取消',
        content: '删除后不可恢复，该助理下的话题也会一并删除。',
        okButtonProps: { danger: true },
        okText: '删除',
        onOk: async () => {
          try {
            await deleteAgent(agent.id)
            removeLocal(agent.id)
            if (detailAgentId === agent.id) setDetailAgentId(null)
            if (editing?.id === agent.id) setEditing(null)
            message.success('已删除')
            if (selectedAgentId === agent.id) {
              const next = agents.find((item) => item.id !== agent.id)
              if (next) {
                setSelectedAgentId(next.id)
                setActiveAgent(toActiveCommunityAgent(next))
              }
            }
          } catch (error) {
            const code = error instanceof Error ? error.message : ''
            if (code === 'BUILTIN') message.error('系统内置助理不可删除')
            else message.error('删除失败')
            throw error
          }
        },
        title: '删除该助理？',
      })
    },
    [agents, detailAgentId, editing, message, removeLocal, selectedAgentId, setActiveAgent, setSelectedAgentId]
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
            onDelete={handleDelete}
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
