'use client'

import { ActionIcon, Button, Flexbox, Text } from '@lobehub/ui'
import { ArrowLeft, MessageSquarePlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { memo } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

import TopicList from './TopicList'

type Props = {
  topics: LocalChatTopic[]
  activeTopicId: string | null
  onNewTopic: () => void
  onSelectTopic: (topicId: string) => void
  onRenameTopic: (id: string, title: string) => void | Promise<void>
  onDeleteTopic: (id: string) => void | Promise<void>
}

const TopicSidebar = memo<Props>(
  ({ topics, activeTopicId, onNewTopic, onSelectTopic, onRenameTopic, onDeleteTopic }) => {
    const router = useRouter()

    return (
      <Flexbox gap={8} height='100%' padding={12} style={{ minWidth: 220 }}>
        <Flexbox align='center' gap={4} horizontal>
          <ActionIcon
            icon={ArrowLeft}
            title='返回首页'
            onClick={() => {
              router.push('/')
            }}
          />
          <Text ellipsis style={{ flex: 1 }} weight={500}>
            话题
          </Text>
        </Flexbox>
        <Button block icon={MessageSquarePlus} onClick={onNewTopic}>
          开启新话题
        </Button>
        <Text fontSize={12} type='secondary' weight={500}>
          列表
        </Text>
        <TopicList
          activeTopicId={activeTopicId}
          onDelete={onDeleteTopic}
          onRename={onRenameTopic}
          onSelect={onSelectTopic}
          topics={topics}
        />
      </Flexbox>
    )
  },
)

TopicSidebar.displayName = 'TopicSidebar'

export default TopicSidebar
