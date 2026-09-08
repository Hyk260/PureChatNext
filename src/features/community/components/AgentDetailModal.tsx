'use client'

import { ActionIcon, Avatar, Block, Button, copyToClipboard, Flex, Icon, Modal, Tag, Text } from '@pure/ui'
import { Collapse, Tabs } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Copy, MessageCircleHeartIcon, MessageCircleQuestionIcon } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { ASSISTANT_CATEGORY_LABELS } from '@/const/community/agents'
import MessageMarkdown from '@/features/chat/MessageMarkdown'
import type { DiscoverAgentExample, DiscoverAgentItem } from '@/features/community/types'
import { useAddCommunityAgent } from '@/features/community/hooks/useAddCommunityAgent'

const styles = createStaticStyles(({ css }) => ({
  demoBubble: css`
    max-width: 85%;
    padding: 10px 12px;
    border-radius: 12px;
    background: ${cssVar.colorBgElevated};
    border: 1px solid ${cssVar.colorBorderSecondary};
    white-space: pre-wrap;
    word-break: break-word;
  `,
  demoUser: css`
    margin-inline-start: auto;
    background: ${cssVar.colorFillTertiary};
  `,
  meta: css`
    font-size: 13px;
    color: ${cssVar.colorTextDescription};
  `,
  sectionTitle: css`
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  `,
  tag: css`
    border-radius: 4px;
  `,
}))

export interface AgentDetailModalProps {
  agent: DiscoverAgentItem | null
  onClose: () => void
  onEdit?: () => void
  onUse?: () => void
  open: boolean
}

function buildDemoMessages(agent: DiscoverAgentItem): DiscoverAgentExample[] {
  const messages: DiscoverAgentExample[] = []
  if (agent.openingMessage?.trim()) {
    messages.push({ content: agent.openingMessage, role: 'assistant' })
  }
  if (agent.examples?.length) {
    messages.push(...agent.examples)
  }
  return messages
}

const DemoChat = memo<{ agent: DiscoverAgentItem }>(({ agent }) => {
  const messages = useMemo(() => buildDemoMessages(agent), [agent])

  if (messages.length === 0) {
    return <Text className={styles.meta}>暂无演示对话</Text>
  }

  return (
    <Block className='flex flex-col gap-3 p-4' variant='outlined'>
      {messages.map((item, index) => (
        <Flex
          className={item.role === 'user' ? 'flex-row justify-end gap-2' : 'flex-row gap-2'}
          key={`${item.role}-${index}`}
        >
          {item.role === 'assistant' ? (
            <Avatar
              avatar={agent.avatar}
              background={agent.backgroundColor || 'transparent'}
              size={28}
              style={{ flex: 'none' }}
            />
          ) : null}
          <div className={[styles.demoBubble, item.role === 'user' ? styles.demoUser : ''].filter(Boolean).join(' ')}>
            {item.content}
          </div>
        </Flex>
      ))}
    </Block>
  )
})

DemoChat.displayName = 'DemoChat'

const OverviewTab = memo<{ agent: DiscoverAgentItem }>(({ agent }) => {
  const usageText = agent.summary || agent.description

  return (
    <Flex className='flex-col gap-4'>
      <Collapse
        defaultActiveKey={['usage']}
        expandIconPlacement='end'
        items={[
          {
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{usageText}</Text>,
            key: 'usage',
            label: '你可以使用该助理做什么？',
          },
        ]}
      />
      <Text as='h3' className={styles.sectionTitle}>
        助理演示
      </Text>
      <DemoChat agent={agent} />
    </Flex>
  )
})

OverviewTab.displayName = 'OverviewTab'

const IntroTab = memo<{ agent: DiscoverAgentItem }>(({ agent }) => {
  const { message } = useApp()
  const systemRole = agent.systemRole.trimEnd()

  const handleCopySystemRole = useCallback(async () => {
    await copyToClipboard(systemRole)
    message.success('已复制')
  }, [message, systemRole])

  return (
    <Flex className='flex-col gap-4'>
      {systemRole ? (
        <Flex className='flex-col gap-2'>
          <Flex className='flex-between'>
            <Text as='h3' className={styles.sectionTitle}>
              助理简介
            </Text>
            <ActionIcon icon={Copy} size='small' title='复制' onClick={() => void handleCopySystemRole()} />
          </Flex>
          <Block className='p-4' variant='outlined' style={{ maxHeight: 360, overflow: 'auto' }}>
            <MessageMarkdown text={systemRole} />
            {agent.tags && agent.tags.length > 0 ? (
              <Flex className='mt-3 flex-row flex-wrap gap-1'>
                {agent.tags.map((tag) => (
                  <Tag className={styles.tag} key={tag} size='small'>
                    {tag}
                  </Tag>
                ))}
              </Flex>
            ) : null}
          </Block>
        </Flex>
      ) : null}

      {agent.openingMessage ? (
        <Flex className='flex-col gap-2'>
          <Text as='h3' className={styles.sectionTitle}>
            开场消息
          </Text>
          <Block className='flex flex-row items-start gap-3 p-4' variant='outlined'>
            <Icon color={cssVar.colorError} icon={MessageCircleHeartIcon} size={20} style={{ marginTop: 2 }} />
            <MessageMarkdown text={agent.openingMessage.trimEnd()} />
          </Block>
        </Flex>
      ) : null}

      {agent.openingQuestions && agent.openingQuestions.length > 0 ? (
        <Flex className='flex-col gap-2'>
          <Flex className='flex-row items-center gap-2'>
            <Text as='h3' className={styles.sectionTitle}>
              开场问题
            </Text>
            <Tag size='small'>{agent.openingQuestions.length}</Tag>
          </Flex>
          <Flex className='flex-col gap-2'>
            {agent.openingQuestions.map((question) => (
              <Block className='flex flex-row items-start gap-3 p-4' key={question} variant='outlined'>
                <Icon color={cssVar.colorWarning} icon={MessageCircleQuestionIcon} size={20} style={{ marginTop: 2 }} />
                <Text style={{ whiteSpace: 'pre-wrap' }}>{question}</Text>
              </Block>
            ))}
          </Flex>
        </Flex>
      ) : null}
    </Flex>
  )
})

IntroTab.displayName = 'IntroTab'

const AgentDetailModal = memo<AgentDetailModalProps>(({ agent, onClose, onEdit, onUse, open }) => {
  const { addAgent, adding } = useAddCommunityAgent()

  if (!agent) return null

  const isOwnedAgent = Boolean(onUse)
  const primaryLabel = isOwnedAgent ? '使用' : '使用助理'
  const primaryLoading = !isOwnedAgent && adding

  const handlePrimaryClick = () => {
    if (onUse) {
      onUse()
      return
    }
    void addAgent(agent)
  }

  return (
    <Modal
      allowFullscreen
      footer={null}
      open={open}
      title={null}
      width={760}
      onCancel={onClose}
    >
      <Flex className='flex-col gap-4'>
        <Flex className='flex-row items-start justify-between gap-4'>
          <Flex className='flex-row items-start gap-3 overflow-hidden'>
            <Avatar
              avatar={agent.avatar}
              background={agent.backgroundColor || 'transparent'}
              size={56}
              style={{ flex: 'none' }}
            />
            <Flex className='flex-col gap-1 overflow-hidden'>
              <Text as='h2' ellipsis style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                {agent.title}
              </Text>
              <Flex className='mt-1 flex-row flex-wrap gap-1'>
                <Tag size='small'>{ASSISTANT_CATEGORY_LABELS[agent.category]}</Tag>
                {agent.tags?.slice(0, 3).map((tag) => (
                  <Tag key={tag} size='small'>
                    {tag}
                  </Tag>
                ))}
              </Flex>
            </Flex>
          </Flex>
          <Flex className='flex-row items-center gap-2'>
            {onEdit ? (
              <Button onClick={onEdit}>编辑</Button>
            ) : null}
            <Button loading={primaryLoading} type='primary' onClick={handlePrimaryClick}>
              {primaryLabel}
            </Button>
          </Flex>
        </Flex>

        <Tabs
          defaultActiveKey='overview'
          items={[
            {
              children: <OverviewTab agent={agent} />,
              key: 'overview',
              label: '概览',
            },
            {
              children: <IntroTab agent={agent} />,
              key: 'intro',
              label: '助理简介',
            },
          ]}
        />
      </Flex>
    </Modal>
  )
})

AgentDetailModal.displayName = 'AgentDetailModal'

export default AgentDetailModal
