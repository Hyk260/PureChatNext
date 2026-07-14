'use client'

import { Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

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
}

const TopicList = memo<Props>(({ topics, activeTopicId, onSelect }) => (
  <Flexbox gap={1} paddingBlock={1}>
    {topics.length > 0 ? (
      topics.map((topic) => (
        <TopicItem
          key={topic.id}
          active={activeTopicId === topic.id}
          topic={topic}
          onSelect={onSelect}
        />
      ))
    ) : (
      <Flexbox paddingBlock={4} paddingInline={12}>
        <Text className={styles.empty} fontSize={12}>
          暂无话题
        </Text>
      </Flexbox>
    )}
  </Flexbox>
))

TopicList.displayName = 'TopicList'

export default TopicList
