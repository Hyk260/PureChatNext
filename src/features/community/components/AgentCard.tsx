'use client'

import { Flex } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { Avatar, Block, Icon, Tag, Text } from '@pure/ui'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { BookTextIcon, ClockIcon, CoinsIcon, GitForkIcon, PuzzleIcon } from 'lucide-react'
import { useRouter } from '@/utils/navigation'
import { memo, useCallback, useState } from 'react'

import { ASSISTANT_CATEGORY_LABELS } from '@/const/community/agents'
import { type DiscoverAgentItem } from '@/features/community/types'
import { createAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  author: css`
    color: ${cssVar.colorTextDescription};
  `,
  desc: css`
    flex: 1;
    margin: 0 !important;
    color: ${cssVar.colorTextSecondary};
  `,
  footer: css`
    margin-block-start: 16px;
    border-block-start: 1px dashed ${cssVar.colorBorder};
    background: ${cssVar.colorBgContainer};
  `,
  secondaryDesc: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  title: css`
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 500 !important;
  `,
  token: css`
    border-radius: 4px;
    font-size: 11px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
  `,
}))

const formatNumber = (value: number) => value.toLocaleString('en-US')

const AgentCard = memo<DiscoverAgentItem>(
  ({
    author,
    avatar,
    backgroundColor,
    category,
    createdAt,
    description,
    forkCount,
    identifier,
    knowledgeCount,
    pluginCount,
    systemRole,
    title,
    tokenUsage,
  }) => {
    const { message } = useApp()
    const router = useRouter()
    const [adding, setAdding] = useState(false)
    const setActiveAgent = useHomeStore((s) => s.setActiveAgent)
    const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
    const upsertLocal = useAgentsStore((s) => s.upsertLocal)

    const handleClick = useCallback(async () => {
      if (adding) return
      setAdding(true)

      try {
        const agent = await createAgent({
          avatar,
          backgroundColor,
          description,
          marketIdentifier: identifier,
          systemRole,
          title,
        })
        upsertLocal(agent)
        setSelectedAgentId(agent.id)
        setActiveAgent({
          avatar: agent.avatar,
          identifier: agent.id,
          systemRole: agent.systemRole,
          title: agent.title,
        })
        message.success(`已添加「${agent.title}」到助理列表`)
        router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
      } catch (error) {
        console.error('[community] add agent failed:', error)
        message.error('添加助理失败，请先登录后再试')
      } finally {
        setAdding(false)
      }
    }, [
      adding,
      avatar,
      backgroundColor,
      description,
      identifier,
      message,
      router,
      setActiveAgent,
      setSelectedAgentId,
      systemRole,
      title,
      upsertLocal,
    ])

    return (
      <Block
        clickable
        data-testid='assistant-item'
        height='100%'
        variant='outlined'
        width='100%'
        style={{
          cursor: adding ? 'wait' : 'pointer',
          opacity: adding ? 0.7 : 1,
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={handleClick}
      >
        <Flex align='flex-start' gap={16} justify='space-between' style={{ padding: 16, width: '100%' }}>
          <Flex gap={12} title={identifier} style={{ overflow: 'hidden' }}>
            <Avatar
              shape='square'
              size={40}
              avatar={avatar}
              background={backgroundColor || 'transparent'}
              style={{ flex: 'none' }}
            />
            <Flex vertical flex={1} gap={2} style={{ overflow: 'hidden' }}>
              <Text className={styles.title} ellipsis>
                {title}
              </Text>
              {/* <div className={styles.author}>{author}</div> */}
            </Flex>
          </Flex>
        </Flex>

        <Flex vertical flex={1} gap={12} style={{ paddingInline: 16 }}>
          <Text as='p' className={styles.desc} ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
            {description}
          </Text>
          <Flex align='center' gap={4}>
            {typeof tokenUsage === 'number' ? (
              <Tag className={styles.token} icon={<Icon icon={CoinsIcon} size={12} />} size='small'>
                {formatNumber(tokenUsage)}
              </Tag>
            ) : null}
            {forkCount ? (
              <Tag className={styles.token} icon={<Icon icon={GitForkIcon} size={12} />} size='small'>
                {formatNumber(forkCount)}
              </Tag>
            ) : null}
            {pluginCount ? (
              <Tag className={styles.token} icon={<Icon icon={PuzzleIcon} size={12} />} size='small'>
                {pluginCount}
              </Tag>
            ) : null}
            {knowledgeCount ? (
              <Tag className={styles.token} icon={<Icon icon={BookTextIcon} size={12} />} size='small'>
                {knowledgeCount}
              </Tag>
            ) : null}
          </Flex>
        </Flex>

        <Flex align='center' className={styles.footer} justify='space-between' style={{ padding: 16 }}>
          <Flex align='center' className={styles.secondaryDesc} gap={4}>
            <Icon icon={ClockIcon} size={14} />
            <span>{formatDate(createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </Flex>
          <span className={styles.secondaryDesc}>{ASSISTANT_CATEGORY_LABELS[category]}</span>
        </Flex>
      </Block>
    )
  }
)

AgentCard.displayName = 'AgentCard'

export default AgentCard
