'use client'

import { ActionIcon, Avatar, Block, Flexbox, Popover, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronsUpDownIcon } from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  chevron: css`
    opacity: 0;
    transition: opacity 0.2s ${cssVar.motionEaseOut};
  `,
  item: css`
    cursor: pointer;
    border-radius: 8px;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  itemActive: css`
    background: ${cssVar.colorFillSecondary};
  `,
  trigger: css`
    &:hover .home-agent-chevron,
    &[data-popup-open] .home-agent-chevron {
      opacity: 1;
    }

    &[data-popup-open] {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

const HomeAgentSelect = memo(() => {
  const [open, setOpen] = useState(false)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)

  useEffect(() => {
    void fetchAgentsList()
  }, [fetchAgentsList])

  const currentAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? DEFAULT_PURE_AI_META,
    [agents, selectedAgentId],
  )

  const selectAgent = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId) ?? DEFAULT_PURE_AI_META
    setSelectedAgentId(agent.id)
    setActiveAgent({
      avatar: agent.avatar,
      identifier: agent.id,
      systemRole: agent.systemRole,
      title: agent.title,
    })
    setOpen(false)
  }

  const listContent = (
    <Flexbox gap={2} padding={4} style={{ width: 360 }}>
      {agents.map((agent) => {
        const active = agent.id === selectedAgentId

        return (
          <Flexbox
            key={agent.id}
            horizontal
            align='center'
            className={[styles.item, active ? styles.itemActive : ''].join(' ')}
            gap={12}
            padding={8}
            onClick={() => selectAgent(agent.id)}
          >
            <Avatar
              avatar={agent.avatar}
              background={agent.backgroundColor ?? undefined}
              shape='square'
              size={32}
            />
            <Flexbox flex={1} gap={2} style={{ overflow: 'hidden' }}>
              <Text ellipsis fontSize={14} weight={500}>
                {agent.title}
              </Text>
              {agent.description ? (
                <Text ellipsis fontSize={12} type='secondary'>
                  {agent.description}
                </Text>
              ) : null}
            </Flexbox>
          </Flexbox>
        )
      })}
    </Flexbox>
  )

  return (
    <Popover
      classNames={{ trigger: styles.trigger }}
      content={listContent}
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
        gap={8}
        padding={4}
        style={{ marginInlineStart: -4, width: 'fit-content' }}
        variant='borderless'
      >
        <Avatar
          avatar={currentAgent.avatar}
          background={currentAgent.backgroundColor ?? undefined}
          shape='square'
          size={32}
        />
        <Text fontSize={16} weight={600}>
          {currentAgent.title}
        </Text>
        <ActionIcon
          className={`${styles.chevron} home-agent-chevron`}
          color={cssVar.colorTextDescription}
          icon={ChevronsUpDownIcon}
          size={{ blockSize: 24, size: 14 }}
        />
      </Block>
    </Popover>
  )
})

HomeAgentSelect.displayName = 'HomeAgentSelect'

export default HomeAgentSelect
