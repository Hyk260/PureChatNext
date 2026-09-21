'use client'

import { Avatar, Block, Button, Text, Flex } from '@pure/ui'
import { memo, useCallback } from 'react'
import type { MouseEvent } from 'react'

import type { AgentListItem } from '@/const/home/agents'

export interface CustomAgentCardProps {
  agent: AgentListItem
  onDelete: (agent: AgentListItem) => void
  onEdit: (agent: AgentListItem) => void
  onOpenDetail: (id: string) => void
  onUse: (agent: AgentListItem) => void
}

const CustomAgentCard = memo<CustomAgentCardProps>(({ agent, onDelete, onEdit, onOpenDetail, onUse }) => {
  const description = agent.description?.trim() || '暂无描述'

  const handleUse = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      onUse(agent)
    },
    [agent, onUse]
  )

  const handleEdit = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      onEdit(agent)
    },
    [agent, onEdit]
  )

  const handleDelete = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      onDelete(agent)
    },
    [agent, onDelete]
  )

  return (
    <Block
      clickable
      className='flex flex-col overflow-hidden'
      data-testid='custom-assistant-item'
      height='100%'
      variant='outlined'
      width='100%'
      onClick={() => onOpenDetail(agent.id)}
    >
      <Flex className='w-full items-start gap-3 overflow-hidden p-4'>
        <Avatar
          avatar={agent.avatar}
          background={agent.backgroundColor || 'transparent'}
          shape='square'
          size={40}
          style={{ flex: 'none' }}
        />
        <Flex className='min-w-0 flex-1 flex-col gap-0.5 overflow-hidden'>
          <Text className='m-0 text-base font-medium' ellipsis>
            {agent.title}
          </Text>
        </Flex>
      </Flex>

      <Flex className='flex-1 flex-col px-4'>
        <Text as='p' className='mb-0 flex-1 text-muted-foreground' ellipsis={{ rows: 3 }}>
          {description}
        </Text>
      </Flex>

      <Flex className='mt-4 flex-between border-t border-dashed border-border p-4'>
        <span className='text-xs text-muted-foreground'>自定义</span>
        <Flex className='items-center gap-2'>
          <Button danger size='small' onClick={handleDelete}>
            删除
          </Button>
          <Button size='small' onClick={handleEdit}>
            编辑
          </Button>
          <Button data-testid='custom-assistant-use-button' size='small' type='primary' onClick={handleUse}>
            使用
          </Button>
        </Flex>
      </Flex>
    </Block>
  )
})

CustomAgentCard.displayName = 'CustomAgentCard'

export default CustomAgentCard
