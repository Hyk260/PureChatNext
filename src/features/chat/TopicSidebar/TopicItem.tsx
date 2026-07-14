'use client'

import { Block, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    cursor: pointer;
    user-select: none;
  `,
}))

type Props = {
  active: boolean
  topic: LocalChatTopic
  onSelect: (topicId: string) => void
}

const TopicItem = memo<Props>(({ active, topic, onSelect }) => (
  <Block
    className={styles.item}
    paddingBlock={8}
    paddingInline={10}
    variant={active ? 'filled' : 'borderless'}
    onClick={() => onSelect(topic.id)}
  >
    <Text
      color={active ? cssVar.colorText : cssVar.colorTextSecondary}
      ellipsis={{ tooltipWhenOverflow: true }}
    >
      {topic.title}
    </Text>
  </Block>
))

TopicItem.displayName = 'TopicItem'

export default TopicItem
