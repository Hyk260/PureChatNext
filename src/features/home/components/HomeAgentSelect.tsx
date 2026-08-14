'use client'

import {
  DropdownMenuItem,
  DropdownMenuItemContent,
  DropdownMenuItemExtra,
  DropdownMenuItemIcon,
  DropdownMenuItemLabel,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuSubmenuArrow,
  DropdownMenuSubmenuRoot,
  DropdownMenuSubmenuTrigger,
  Icon,
} from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import { BotIcon, Check, ChevronRight } from 'lucide-react'
import { memo, useEffect, useMemo } from 'react'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  extra: css`
    overflow: hidden;
    max-width: 72px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  popup: css`
    overflow: hidden auto;
    width: 200px;
    min-width: 200px !important;
    max-width: 200px;
    max-height: min(320px, var(--available-height));
  `,
}))

interface HomeAgentSelectProps {
  onSelect?: () => void
}

const HomeAgentSelect = memo<HomeAgentSelectProps>(({ onSelect }) => {
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  const currentAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? DEFAULT_PURE_AI_META,
    [agents, selectedAgentId]
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
    onSelect?.()
  }

  return (
    <DropdownMenuSubmenuRoot>
      <DropdownMenuSubmenuTrigger>
        <DropdownMenuItemContent>
          <DropdownMenuItemIcon>
            <Icon icon={BotIcon} size={16} />
          </DropdownMenuItemIcon>
          <DropdownMenuItemLabel>选择助理</DropdownMenuItemLabel>
          <DropdownMenuItemExtra className={styles.extra}>{currentAgent.title}</DropdownMenuItemExtra>
          <DropdownMenuSubmenuArrow>
            <Icon icon={ChevronRight} size={12} />
          </DropdownMenuSubmenuArrow>
        </DropdownMenuItemContent>
      </DropdownMenuSubmenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner placement='right' sideOffset={8}>
          <DropdownMenuPopup className={styles.popup}>
            {agents.map((agent) => {
              const active = agent.id === selectedAgentId

              return (
                <DropdownMenuItem key={agent.id} label={agent.title} onClick={() => selectAgent(agent.id)}>
                  <DropdownMenuItemContent>
                    <DropdownMenuItemLabel>{agent.title}</DropdownMenuItemLabel>
                    {active ? (
                      <DropdownMenuItemExtra>
                        <Icon icon={Check} size={16} />
                      </DropdownMenuItemExtra>
                    ) : null}
                  </DropdownMenuItemContent>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuPopup>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenuSubmenuRoot>
  )
})

HomeAgentSelect.displayName = 'HomeAgentSelect'

export default HomeAgentSelect
