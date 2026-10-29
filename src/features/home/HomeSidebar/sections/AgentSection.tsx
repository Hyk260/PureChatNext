'use client'

import { AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger, Flex, Skeleton, Text } from '@pure/ui'
import { toast, createStaticStyles, cssVar } from '@lobehub/ui'
import { useRouter } from 'next/navigation'
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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
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
  const refreshAgent = useAgentsStore((s) => s.refreshAgent)
  const removeLocal = useAgentsStore((s) => s.removeLocal)

  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  const applyAgent = useCallback(
    (agent: AgentListItem) => {
      setSelectedAgentId(agent.id)
      refreshAgent(agent.id).catch(() => toast.error('刷新助理配置失败'))
      router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
    },
    [refreshAgent, router, setSelectedAgentId]
  )

  const handleCreate = async (values: AgentFormValues) => {
    setSaving(true)
    try {
      const agent = await createAgent(values)
      upsertLocal(agent)
      setCreateOpen(false)
      toast.success('已创建助理')
      applyAgent(agent)
    } catch (error) {
      console.error('[agents] create failed:', error)
      toast.error('创建失败')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (values: AgentFormValues) => {
    if (!editing) return
    setSaving(true)
    try {
      const agent = editing.marketIdentifier
        ? await createAgent({
            ...values,
            model: editing.model ?? undefined,
            params: editing.params ?? undefined,
            provider: editing.provider ?? undefined,
          })
        : await updateAgent(editing.id, values)
      upsertLocal(agent)
      setEditing(null)
      toast.success(editing.marketIdentifier ? '已另存为自定义助理' : '已保存')
      if (editing.marketIdentifier) applyAgent(agent)
    } catch (error) {
      console.error('[agents] update failed:', error)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEdit = async (agent: AgentListItem) => {
    try {
      setEditing(await refreshAgent(agent.id))
    } catch {
      toast.error('读取助理配置失败')
    }
  }

  const handlePin = async (agent: AgentListItem, pinned: boolean) => {
    try {
      await updateAgent(agent.id, { pinned })
      await fetchAgentsList({ force: true })
      toast.success(pinned ? '已置顶' : '已取消置顶')
    } catch (error) {
      console.error('[agents] pin failed:', error)
      toast.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    await deleteAgent(id)
    removeLocal(id)
    toast.success('已删除')
    if (selectedAgentId === id && agents[0]) {
      applyAgent(agents.find((a) => a.id !== id) ?? agents[0])
    }
  }

  const renderAgentContent = () => {
    if (!loaded && loading) {
      return Array.from({ length: 6 }).map((_, index) => (
        <div className={styles.skeletonRow} key={index}>
          <Skeleton.Avatar animated size={28} />
          <Skeleton.Text rows={1} style={{ flex: 1 }} />
        </div>
      ))
    }

    if (agents.length > 0) {
      return agents.map((agent) => (
        <AgentItem
          key={agent.id}
          agent={agent}
          onDelete={handleDelete}
          onEdit={handleOpenEdit}
          onPin={handlePin}
          onSelect={applyAgent}
        />
      ))
    }

    return (
      <Flex className='flex-col py-1 px-3'>
        <Text className={`${styles.empty} text-[12px]`}>暂无内容</Text>
      </Flex>
    )
  }

  return (
    <>
      <AccordionItem value={itemKey}>
        <AccordionHeader style={{ paddingBlock: 4, paddingInline: '8px 4px' }}>
          <AccordionTrigger>
            <Text className='text-[12px] font-medium' ellipsis type='secondary'>
              助理
            </Text>
          </AccordionTrigger>
          {<SectionActions addMenuItems={addMenu} menuItems={dropdownMenu} />}
        </AccordionHeader>
        <AccordionPanel>
          <Flex className='flex-col gap-px py-px'>{renderAgentContent()}</Flex>
        </AccordionPanel>
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
