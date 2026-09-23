'use client'

import { Avatar, Block, Button, Icon, Tag, Text, Flex } from '@pure/ui'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { BookTextIcon, ClockIcon, CoinsIcon, GitForkIcon, PuzzleIcon } from 'lucide-react'
import { memo, useCallback } from 'react'
import type { MouseEvent } from 'react'

import { ASSISTANT_CATEGORY_LABELS } from '@/const/community/agents'
import type { DiscoverAgentItem } from '@/features/community/types'
import { useAddCommunityAgent } from '@/features/community/hooks/useAddCommunityAgent'

const styles = createStaticStyles(({ css }) => ({
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

export interface AgentCardProps extends DiscoverAgentItem {
  onOpenDetail: (identifier: string) => void
}

const AgentCard = memo<AgentCardProps>(({ onOpenDetail, ...item }) => {
  const {
    avatar,
    backgroundColor,
    category,
    createdAt,
    description,
    forkCount,
    identifier,
    knowledgeCount,
    pluginCount,
    title,
    tokenUsage,
  } = item

  const { addAgent, adding } = useAddCommunityAgent()

  const handleOpenDetail = useCallback(() => {
    if (adding) return
    onOpenDetail(identifier)
  }, [adding, identifier, onOpenDetail])

  const handleUse = (event: MouseEvent) => {
    event.stopPropagation()
    void addAgent(item)
  }

  return (
    <Block
      clickable
      className='flex flex-col'
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
      onClick={handleOpenDetail}
    >
      <Flex className='items-start gap-4 justify-between p-4 w-full'>
        <Flex className='gap-3 overflow-hidden' title={identifier}>
          <Avatar
            shape='square'
            size={40}
            avatar={avatar}
            background={backgroundColor || 'transparent'}
            style={{ flex: 'none' }}
          />
          <Flex className='flex-col flex-1 gap-0.5 overflow-hidden'>
            <Text className={styles.title} ellipsis>
              {title}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      <Flex className='flex-col flex-1 gap-3 px-4'>
        <Text as='p' className={styles.desc} ellipsis={{ rows: 3 }}>
          {description}
        </Text>
        <Flex className='items-center gap-1'>
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

      <Flex className={[styles.footer, 'flex-between p-4']}>
        <Flex className={[styles.secondaryDesc, 'items-center gap-1']}>
          <Icon icon={ClockIcon} size={14} />
          <span>{formatDate(createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </Flex>
        <Flex className='items-center gap-2'>
          <span className={styles.secondaryDesc}>{ASSISTANT_CATEGORY_LABELS[category]}</span>
          {/* <Button
            data-testid='assistant-use-button'
            loading={adding}
            size='small'
            type='primary'
            onClick={handleUse}
          >
            使用助理
          </Button> */}
        </Flex>
      </Flex>
    </Block>
  )
})

AgentCard.displayName = 'AgentCard'

export default AgentCard
