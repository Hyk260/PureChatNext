'use client'

import { AccordionItem, Flexbox, Text } from '@lobehub/ui'
import { App } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { useRouter } from '@/utils/navigation'
import { memo, useCallback, useEffect, useState } from 'react'

import type { AgentListItem } from '@/const/home/agents'
import { createAgent, deleteAgent, updateAgent } from '@/features/home/agentApi'
import AgentItem from '@/features/home/HomeSidebar/components/AgentItem'
import SectionActions from '@/features/home/HomeSidebar/components/SectionActions'
import { useAgentSectionAddMenu } from '@/features/home/HomeSidebar/hooks/useAgentSectionAddMenu'
import { useAgentSectionDropdownMenu } from '@/features/home/HomeSidebar/hooks/useAgentSectionDropdownMenu'
import AgentFormModal, {
  type AgentFormValues,
} from '@/features/home/HomeSidebar/modals/AgentFormModal'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
}))

interface AgentSectionProps {
  itemKey: string
}

const AgentSection = memo<AgentSectionProps>(({ itemKey }) => {
  const { message } = App.useApp()
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
  const upsertLocal = useAgentsStore((s) => s.upsertLocal)
  const removeLocal = useAgentsStore((s) => s.removeLocal)

  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  useEffect(() => {
    void fetchAgentsList()
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
    [router, setActiveAgent, setSelectedAgentId],
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
      await fetchAgentsList()
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
          <Text ellipsis fontSize={12} type='secondary' weight={500}>
            助理
          </Text>
        }
      >
        <Flexbox gap={1} paddingBlock={1}>
          {agents.length > 0 ? (
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
            <Flexbox paddingBlock={4} paddingInline={12}>
              <Text className={styles.empty} fontSize={12}>
                暂无内容
              </Text>
            </Flexbox>
          )}
        </Flexbox>
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
