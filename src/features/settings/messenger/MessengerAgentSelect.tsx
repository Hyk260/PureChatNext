'use client'

import { Avatar, Flex, Select } from '@pure/ui'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'

import type { AgentListItem } from '@/const/home/agents'

type MessengerAgentSelectProps = {
  agents: AgentListItem[]
  disabled?: boolean
  onChange: (agentId: string) => void
  value: string
}

function renderAgentOption(
  option: { label?: ReactNode; value?: string | number | null },
  agentById: Map<string, AgentListItem>
) {
  const agent = agentById.get(String(option.value))
  return (
    <Flex className='min-w-0 items-center gap-2'>
      <Avatar
        avatar={agent?.avatar ?? '🤖'}
        background={agent?.backgroundColor ?? undefined}
        shape='square'
        size={22}
      />
      <span className='truncate'>{option.label}</span>
    </Flex>
  )
}

const MessengerAgentSelect = memo<MessengerAgentSelectProps>(({ agents, disabled, onChange, value }) => {
  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])

  const options = useMemo(
    () => agents.map((agent) => ({ label: agent.title, value: agent.id })),
    [agents]
  )

  return (
    <Select
      disabled={disabled}
      labelRender={(option) => renderAgentOption(option, agentById)}
      optionRender={(option) => renderAgentOption(option, agentById)}
      options={options}
      style={{ maxWidth: 300, width: '100%' }}
      value={value}
      onChange={(next) => {
        if (typeof next === 'string') onChange(next)
      }}
    />
  )
})

MessengerAgentSelect.displayName = 'MessengerAgentSelect'

export default MessengerAgentSelect
