'use client'

import { Flex, Typography } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { type LocalChatTopic } from '@/features/chat/types'

import TopicItem from './TopicItem'

const styles = createStaticStyles(({ css }) => ({
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
}))

type Props = {
  topics: LocalChatTopic[]
  activeTopicId: string | null
  onSelect: (topicId: string) => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
}

const TopicList = memo<Props>(({ topics, activeTopicId, onSelect, onRename, onDelete }) => (
  <Flex vertical gap={1} style={{ paddingBlock: 1 }}>
    {topics.length > 0 ? (
      topics.map((topic) => (
        <TopicItem
          active={activeTopicId === topic.id}
          key={topic.id}
          onDelete={onDelete}
          onRename={onRename}
          onSelect={onSelect}
          topic={topic}
        />
      ))
    ) : (
      <Flex vertical style={{ paddingBlock: 4, paddingInline: 12 }}>
        <Typography.Text className={styles.empty} style={{ fontSize: 12 }}>
          暂无话题
        </Typography.Text>
      </Flex>
    )}
  </Flex>
))

TopicList.displayName = 'TopicList'

export default TopicList
