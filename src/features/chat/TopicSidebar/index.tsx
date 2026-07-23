'use client'

import { Flex, Typography, Button } from 'antd'
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

    const breadcrumb = [
      {
        href: '/chat',
        title: '话题',
      },
    ]

    return (
      <Flex vertical gap={8} style={{ height: '100%', overflow: 'hidden', width: 240 }}>
        <SideBarHeaderLayout
          breadcrumb={breadcrumb}
          collapsed={leftCollapsed}
          homeHref='/'
          showHomeIcon
          onToggleCollapsed={toggleLeftCollapsed}
        />
        <Flex
          vertical
          flex={1}
          gap={8}
          style={{ paddingInline: 12, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}
        >
          <Button block icon={<MessageSquarePlus size={16} />} onClick={onNewTopic}>
            开启新话题
          </Button>
          <Typography.Text type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
            列表
          </Typography.Text>
          <TopicList
            activeTopicId={activeTopicId}
            onDelete={onDeleteTopic}
            onRename={onRenameTopic}
            onSelect={onSelectTopic}
            topics={topics}
          />
        </Flex>
      </Flex>
    )
  }
)

TopicSidebar.displayName = 'TopicSidebar'

export default TopicSidebar
