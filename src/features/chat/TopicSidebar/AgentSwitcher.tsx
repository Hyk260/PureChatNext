'use client'

import { ActionIcon, Avatar, Block, Icon, Popover, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { ChevronsUpDownIcon, PinIcon } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import Scrollbar from '@/components/Scrollbar'
import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    cursor: pointer;
    border-radius: ${cssVar.borderRadius};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  itemActive: css`
    background: ${cssVar.colorFillSecondary};
  `,
  trigger: css`
    min-width: 0;

    &[data-popup-open] {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

type Props = {
  agents: AgentListItem[]
  currentAgentId: string
  onSelect: (agent: AgentListItem) => void
}

const AgentSwitcher = memo<Props>(({ agents, currentAgentId, onSelect }) => {
  const [open, setOpen] = useState(false)
  const currentAgent = useMemo(
    () => agents.find((agent) => agent.id === currentAgentId) ?? DEFAULT_PURE_AI_META,
    [agents, currentAgentId]
  )

  const content = (
    <Scrollbar maxHeight={420} style={{ height: 'auto', width: 240 }} viewStyle={{ padding: 4 }}>
      <Flex className='flex-col gap-0.5'>
        {agents.map((agent) => {
          const active = agent.id === currentAgentId
          return (
            <Flex
              className={[cx(styles.item, active && styles.itemActive), 'flex-row items-center gap-2 p-1.5']}

              key={agent.id}
              role='button'
              tabIndex={0}
              onClick={() => {
                onSelect(agent)
                setOpen(false)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onSelect(agent)
                setOpen(false)
              }}
            >
              <Avatar avatar={agent.avatar} background={agent.backgroundColor ?? undefined} shape='square' size={28} />
              <Text ellipsis style={{ flex: 1, minWidth: 0 }} type={active ? undefined : 'secondary'}>
                {agent.title}
              </Text>
              {agent.pinned ? <Icon color={cssVar.colorTextTertiary} icon={PinIcon} size={14} /> : null}
            </Flex>
          )
        })}
      </Flex>
    </Scrollbar>
  )

  return (
    <Popover
      content={content}
      open={open}
      placement='bottomLeft'
      styles={{ content: { padding: 0 } }}
      trigger='click'
      onOpenChange={setOpen}
    >
      <Block
        clickable
        horizontal
        align='center'
        className={styles.trigger}
        gap={8}
        padding={2}
        style={{ maxWidth: 176 }}
        variant='borderless'
      >
        <Avatar
          avatar={currentAgent.avatar}
          background={currentAgent.backgroundColor ?? undefined}
          shape='square'
          size={28}
        />
        <Text ellipsis style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>
          {currentAgent.title}
        </Text>
        <ActionIcon icon={ChevronsUpDownIcon} size='small' />
      </Block>
    </Popover>
  )
})

AgentSwitcher.displayName = 'AgentSwitcher'

export default AgentSwitcher
