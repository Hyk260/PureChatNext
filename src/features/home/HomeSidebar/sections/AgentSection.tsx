'use client'

import { AccordionItem, Avatar, Block, Center, Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { useRouter } from 'next/navigation'
import { memo } from 'react'

import { HOME_AGENTS } from '@/const/home/agents'
import { clearDraftMessages } from '@/features/chat/chatLocalStorage'
import SectionActions from '@/features/home/HomeSidebar/components/SectionActions'
import { useAgentSectionDropdownMenu } from '@/features/home/HomeSidebar/hooks/useAgentSectionDropdownMenu'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  agentItem: css`
    cursor: pointer;
    user-select: none;
  `,
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
}))

interface AgentSectionProps {
  itemKey: string
}

const AgentSection = memo<AgentSectionProps>(({ itemKey }) => {
  const router = useRouter()
  const dropdownMenu = useAgentSectionDropdownMenu()
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  return (
    <AccordionItem
      action={<SectionActions menuItems={dropdownMenu} />}
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
        {HOME_AGENTS.length > 0 ? (
          HOME_AGENTS.map((agent) => {
            const active = selectedAgentId === agent.id

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
                onClick={() => {
                  setSelectedAgentId(agent.id)
                  setActiveAgent({
                    avatar: agent.avatar,
                    identifier: agent.id,
                    systemRole: agent.systemRole,
                    title: agent.title,
                  })
                  clearDraftMessages(agent.id)
                  router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
                }}
              >
                <Center flex='none' height={28} width={28}>
                  <Avatar avatar={agent.avatar} background={agent.backgroundColor} size={28} />
                </Center>
                <Flexbox flex={1} style={{ overflow: 'hidden' }}>
                  <Text
                    color={active ? cssVar.colorText : cssVar.colorTextSecondary}
                    ellipsis={{ tooltipWhenOverflow: true }}
                  >
                    {agent.title}
                  </Text>
                </Flexbox>
              </Block>
            )
          })
        ) : (
          <Flexbox paddingBlock={4} paddingInline={12}>
            <Text className={styles.empty} fontSize={12}>
              暂无内容
            </Text>
          </Flexbox>
        )}
      </Flexbox>
    </AccordionItem>
  )
})

AgentSection.displayName = 'AgentSection'

export default AgentSection
