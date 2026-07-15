'use client'

import { ActionIcon, Avatar, Block, Center, Flexbox, Text } from '@lobehub/ui'
import { App, Popconfirm } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Pencil, Trash2 } from 'lucide-react'
import { memo, useState } from 'react'
import type { MouseEvent } from 'react'

import type { AgentListItem } from '@/const/home/agents'

const styles = createStaticStyles(({ css }) => ({
  agentItem: css`
    cursor: pointer;
    user-select: none;

    & .agent-actions {
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }

    &:hover .agent-actions {
      opacity: 1;
      pointer-events: auto;
    }
  `,
}))

interface AgentItemProps {
  active: boolean
  agent: AgentListItem
  onDelete: (id: string) => void | Promise<void>
  onEdit: (agent: AgentListItem) => void
  onSelect: (agent: AgentListItem) => void
}

const AgentItem = memo<AgentItemProps>(({ active, agent, onDelete, onEdit, onSelect }) => {
  const { message } = App.useApp()
  const [deleting, setDeleting] = useState(false)
  const canDelete = !agent.isBuiltin

  const handleEdit = (event: MouseEvent) => {
    event.stopPropagation()
    onEdit(agent)
  }

  const handleConfirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onDelete(agent.id)
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'BUILTIN') message.error('系统内置助理不可删除')
      else if (code === 'HAS_TOPICS') message.error('该助理下还有话题，请先删除话题')
      else message.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Block
      key={agent.id}
      horizontal
      align='center'
      className={styles.agentItem}
      gap={8}
      height={36}
      paddingInline={4}
      variant={active ? 'filled' : 'borderless'}
      onClick={() => onSelect(agent)}
    >
      <Center flex='none' height={28} width={28}>
        <Avatar avatar={agent.avatar} background={agent.backgroundColor ?? undefined} size={28} />
      </Center>
      <Flexbox flex={1} style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text
          color={active ? cssVar.colorText : cssVar.colorTextSecondary}
          ellipsis={{ tooltipWhenOverflow: true }}
        >
          {agent.title}
        </Text>
      </Flexbox>
      <Flexbox align='center' className='agent-actions' gap={2} horizontal>
        <ActionIcon icon={Pencil} size={16} title='编辑' onClick={handleEdit} />
        {canDelete ? (
          <Popconfirm
            cancelText='取消'
            okButtonProps={{ danger: true, loading: deleting }}
            okText='删除'
            title='删除该助理？'
            description='删除后不可恢复。若仍有话题将无法删除。'
            onCancel={(event?: MouseEvent) => event?.stopPropagation()}
            onConfirm={() => void handleConfirmDelete()}
            onPopupClick={(event) => event.stopPropagation()}
          >
            <span
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              role='presentation'
            >
              <ActionIcon icon={Trash2} size={16} title='删除' />
            </span>
          </Popconfirm>
        ) : null}
      </Flexbox>
    </Block>
  )
})

AgentItem.displayName = 'AgentItem'

export default AgentItem
