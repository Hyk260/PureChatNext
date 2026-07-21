'use client'

import { Button, Flexbox, Text } from '@lobehub/ui'
import { MessageSquarePlus } from 'lucide-react'
import { memo } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { type LocalChatTopic } from '@/features/chat/types'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

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
    const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
    const toggleLeftCollapsed = useChatUiStore((s) => s.toggleLeftCollapsed)

    return (
      <Flexbox gap={8} height='100%' style={{ overflow: 'hidden', width: 240 }}>
        <SideBarHeaderLayout
          breadcrumb={[
            {
              href: '/chat',
              title: '话题',
            },
          ]}
          collapsed={leftCollapsed}
          homeHref='/'
          showHomeIcon
          onToggleCollapsed={toggleLeftCollapsed}
        />
        <Flexbox flex={1} gap={8} paddingInline={12} style={{ minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
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
      </Flexbox>
    )
  },
)

TopicSidebar.displayName = 'TopicSidebar'

export default TopicSidebar
