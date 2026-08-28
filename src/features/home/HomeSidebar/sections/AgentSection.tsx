'use client'

import { AccordionItem, Flex, Skeleton, Text } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar } from 'antd-style'
import { useRouter } from '@/utils/navigation'
import { memo, useCallback, useEffect, useState } from 'react'

import type { AgentListItem } from '@/const/home/agents'
import { createAgent, deleteAgent, updateAgent } from '@/features/home/agentApi'
import AgentItem from '@/features/home/HomeSidebar/components/AgentItem'
import SectionActions from '@/features/home/HomeSidebar/components/SectionActions'
import { useAgentSectionAddMenu } from '@/features/home/HomeSidebar/hooks/useAgentSectionAddMenu'
import { useAgentSectionDropdownMenu } from '@/features/home/HomeSidebar/hooks/useAgentSectionDropdownMenu'
import AgentFormModal from '@/features/home/HomeSidebar/modals/AgentFormModal'
import type { AgentFormValues } from '@/features/home/HomeSidebar/modals/AgentFormModal'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  skeletonRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding-inline: 4px;
  `,
}))

interface AgentSectionProps {
  itemKey: string
}

const AgentSection = memo<AgentSectionProps>(({ itemKey }) => {
  const { message } = useApp()
  const router = useRouter()

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AgentListItem | null>(null)
  const [saving, setSaving] = useState(false)

  const dropdownMenu = useAgentSectionDropdownMenu()
  const addMenu = useAgentSectionAddMenu({
    onAddFromMarket: () => router.push('/community/agent'),
    onCreateAgent: () => setCreateOpen(true),
  })

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)
  const loaded = useAgentsStore((s) => s.loaded)
  const loading = useAgentsStore((s) => s.loading)
  const upsertLocal = useAgentsStore((s) => s.upsertLocal)
  const removeLocal = useAgentsStore((s) => s.removeLocal)

  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  const applyAgent = useCallback(
    (agent: AgentListItem) => {
      setSelectedAgentId(agent.id)
      setActiveAgent({
        avatar: agent.avatar,
        identifier: agent.id,
        systemRole: agent.systemRole,
        title: agent.title,
      })
      router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
    },
    [router, setActiveAgent, setSelectedAgentId]
  )

  const handleCreate = async (values: AgentFormValues) => {
    setSaving(true)
    try {
      const agent = await createAgent(values)
      upsertLocal(agent)
      setCreateOpen(false)
      message.success('已创建助理')
      applyAgent(agent)
    } catch (error) {
      console.error('[agents] create failed:', error)
      message.error('创建失败')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (values: AgentFormValues) => {
    if (!editing) return
    setSaving(true)
    try {
      const agent = await updateAgent(editing.id, values)
      upsertLocal(agent)
      if (selectedAgentId === agent.id) {
        setActiveAgent({
          avatar: agent.avatar,
          identifier: agent.id,
          systemRole: agent.systemRole,
          title: agent.title,
        })
      }
      setEditing(null)
      message.success('已保存')
    } catch (error) {
      console.error('[agents] update failed:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handlePin = async (agent: AgentListItem, pinned: boolean) => {
    try {
      await updateAgent(agent.id, { pinned })
      await fetchAgentsList({ force: true })
      message.success(pinned ? '已置顶' : '已取消置顶')
    } catch (error) {
      console.error('[agents] pin failed:', error)
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    await deleteAgent(id)
    removeLocal(id)
    message.success('已删除')
    if (selectedAgentId === id && agents[0]) {
      applyAgent(agents.find((a) => a.id !== id) ?? agents[0])
    }
  }

  return (
    <>
      <AccordionItem
        action={<SectionActions addMenuItems={addMenu} menuItems={dropdownMenu} />}
        itemKey={itemKey}
        paddingBlock={4}
        paddingInline='8px 4px'
        title={
          <Text ellipsis type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
            助理
          </Text>
        }
      >
        <Flex className='flex-col gap-px py-px'>
          {!loaded && loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div className={styles.skeletonRow} key={index}>
                <Skeleton.Avatar active size={28} />
                <Skeleton active paragraph={{ rows: 1 }} title={false} style={{ flex: 1 }} />
              </div>
            ))
          ) : agents.length > 0 ? (
            agents.map((agent) => (
              <AgentItem
                key={agent.id}
                agent={agent}
                onDelete={handleDelete}
                onEdit={setEditing}
                onPin={handlePin}
                onSelect={applyAgent}
              />
            ))
          ) : (
            <Flex className='flex-col py-1 px-3'>
              <Text className={styles.empty} style={{ fontSize: 12 }}>
                暂无内容
              </Text>
            </Flex>
          )}
        </Flex>
      </AccordionItem>

      <AgentFormModal
        confirmLoading={saving}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
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

AgentSection.displayName = 'AgentSection'

export default AgentSection
