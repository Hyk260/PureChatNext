'use client'

import { Avatar, Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui'
import { App } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { BookTextIcon, ClockIcon, CoinsIcon, GitForkIcon, PuzzleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useState } from 'react'

import { ASSISTANT_CATEGORY_LABELS } from '@/const/community/agents'
import type { DiscoverAgentItem } from '@/features/community/types'
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

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
    const { message } = App.useApp()
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
        onClick={() => void handleClick()}
      >
        <Flexbox
          horizontal
          align='flex-start'
          gap={16}
          justify='space-between'
          padding={16}
          width='100%'
        >
          <Flexbox horizontal gap={12} style={{ overflow: 'hidden' }} title={identifier}>
            <Avatar
              avatar={avatar}
              background={backgroundColor || 'transparent'}
              shape='square'
              size={40}
              style={{ flex: 'none' }}
            />
            <Flexbox flex={1} gap={2} style={{ overflow: 'hidden' }}>
              <Text as='h2' className={styles.title} ellipsis>
                {title}
              </Text>
              {/* <div className={styles.author}>{author}</div> */}
            </Flexbox>
          </Flexbox>
        </Flexbox>

        <Flexbox flex={1} gap={12} paddingInline={16}>
          <Text as='p' className={styles.desc} ellipsis={{ rows: 3 }}>
            {description}
          </Text>
          <Flexbox horizontal align='center' gap={4}>
            {typeof tokenUsage === 'number' ? (
              <Tag className={styles.token} icon={<Icon icon={CoinsIcon} size={12} />}>
                {formatNumber(tokenUsage)}
              </Tag>
            ) : null}
            {forkCount ? (
              <Tag className={styles.token} icon={<Icon icon={GitForkIcon} size={12} />}>
                {formatNumber(forkCount)}
              </Tag>
            ) : null}
            {pluginCount ? (
              <Tag className={styles.token} icon={<Icon icon={PuzzleIcon} size={12} />}>
                {pluginCount}
              </Tag>
            ) : null}
            {knowledgeCount ? (
              <Tag className={styles.token} icon={<Icon icon={BookTextIcon} size={12} />}>
                {knowledgeCount}
              </Tag>
            ) : null}
          </Flexbox>
        </Flexbox>

        <Flexbox
          horizontal
          align='center'
          className={styles.footer}
          justify='space-between'
          padding={16}
        >
          <Flexbox horizontal align='center' className={styles.secondaryDesc} gap={4}>
            <Icon icon={ClockIcon} size={14} />
            <span>{formatDate(createdAt)}</span>
          </Flexbox>
          <span className={styles.secondaryDesc}>{ASSISTANT_CATEGORY_LABELS[category]}</span>
        </Flexbox>
      </Block>
    )
  },
)

AgentCard.displayName = 'AgentCard'

export default AgentCard
