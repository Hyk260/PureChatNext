'use client'

import { Avatar, Select } from '@lobehub/ui'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

import type { AgentListItem } from '@/const/home/agents'

type TaskAssigneePickerProps = {
  agents: AgentListItem[]
  compact?: boolean
  disabled?: boolean
  onChange: (agentId: string) => void
  value: string
}

type AgentSelectOption = { label: ReactNode; value: string }

function renderAgentOption(
  option: AgentSelectOption,
  agentById: Map<string, AgentListItem>,
  compact: boolean
) {
  const agent = agentById.get(option.value)
  return (
    <span className='flex min-w-0 items-center gap-2'>
      <Avatar
        avatar={agent?.avatar ?? '🤖'}
        background={agent?.backgroundColor ?? undefined}
        shape='square'
        size={compact ? 26 : 22}
      />
      {!compact && <span className='truncate'>{agent?.title ?? String(option.label)}</span>}
    </span>
  )
}

export function TaskAssigneePicker({ agents, compact = false, disabled, onChange, value }: TaskAssigneePickerProps) {
  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const options = useMemo(
    () => agents.map((agent) => ({ label: agent.title, title: agent.title, value: agent.id })),
    [agents]
  )
  const renderOption = (option: AgentSelectOption) => renderAgentOption(option, agentById, false)

  return (
    <span className='shrink-0' title={agentById.get(value)?.title ?? '选择助理'}>
      <Select
        aria-label='执行助理'
        className={compact ? 'w-10' : 'w-44'}
        disabled={disabled}
        labelRender={(option) => renderAgentOption(option, agentById, compact)}
        optionRender={renderOption}
        options={options}
        popupMatchSelectWidth={260}
        showSearch
        size='small'
        style={compact ? { width: 40 } : undefined}
        suffixIcon={compact ? null : undefined}
        value={value}
        variant='borderless'
        onChange={(next) => {
          if (typeof next === 'string') onChange(next)
        }}
      />
    </span>
  )
}
