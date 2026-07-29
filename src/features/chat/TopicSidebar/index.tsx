'use client'

import { Button, Flex } from 'antd'
import { ActionIcon, Text } from '@pure/ui'
import { ArrowLeft, MessageSquarePlus } from 'lucide-react'
import { useRouter } from '@/utils/navigation'
import { memo, useCallback, useMemo } from 'react'

import Scrollbar from '@/components/Scrollbar'
import { type AgentListItem } from '@/const/home/agents'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { type LocalChatTopic, type TopicDeleteScope, type TopicGroupMode } from '@/features/chat/types'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import AgentSwitcher from './AgentSwitcher'
import TopicActions from './TopicActions'
import TopicFilter from './TopicFilter'
import TopicList from './TopicList'

type Props = {
  agents: AgentListItem[]
  currentAgentId: string
  loading: boolean
  topics: LocalChatTopic[]
  activeTopicId: string | null
  onAgentSelect: (agent: AgentListItem) => void
  onNewTopic: () => void
  onSelectTopic: (topicId: string) => void
  onRenameTopic: (id: string, title: string) => void | Promise<void>
  onDeleteTopic: (id: string) => void | Promise<void>
  onDeleteTopics: (scope: TopicDeleteScope) => void | Promise<void>
  onFavoriteTopic: (id: string, favorite: boolean) => void | Promise<void>
  onProjectChange: (id: string, projectName: string | null) => void | Promise<void>
}

const TopicSidebar = memo<Props>(
  ({
    agents,
    currentAgentId,
    loading,
    topics,
    activeTopicId,
    onAgentSelect,
    onNewTopic,
    onSelectTopic,
    onRenameTopic,
    onDeleteTopic,
    onDeleteTopics,
    onFavoriteTopic,
    onProjectChange,
  }) => {
    const router = useRouter()
    const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
    const toggleLeftCollapsed = useChatUiStore((s) => s.toggleLeftCollapsed)
    const groupMode = useChatUiStore((s) => s.topicGroupModeByAgent[currentAgentId] ?? 'byTime')
    const pageSize = useChatUiStore((s) => s.topicPageSize)
    const sortBy = useChatUiStore((s) => s.topicSortBy)
    const setGroupMode = useChatUiStore((s) => s.setTopicGroupMode)
    const setPageSize = useChatUiStore((s) => s.setTopicPageSize)
    const setSortBy = useChatUiStore((s) => s.setTopicSortBy)
    const projectNames = useMemo(
      () =>
        [...new Set(topics.flatMap((topic) => (topic.projectName ? [topic.projectName] : [])))].sort((a, b) =>
          a.localeCompare(b, 'zh-CN')
        ),
      [topics]
    )
    const handleGroupModeChange = useCallback(
      (mode: TopicGroupMode) => setGroupMode(currentAgentId, mode),
      [currentAgentId, setGroupMode]
    )
    const unfavoritedCount = useMemo(() => topics.filter((topic) => !topic.favorite).length, [topics])

    return (
      <Flex vertical gap={8} style={{ height: '100%', overflow: 'hidden', width: 240 }}>
        <SideBarHeaderLayout
          collapsed={leftCollapsed}
          left={
            <Flex align='center' flex={1} gap={2} style={{ minWidth: 0 }}>
              <ActionIcon icon={ArrowLeft} size='small' title='返回首页' onClick={() => router.push('/')} />
              <AgentSwitcher agents={agents} currentAgentId={currentAgentId} onSelect={onAgentSelect} />
            </Flex>
          }
          showHomeIcon={false}
          onToggleCollapsed={toggleLeftCollapsed}
        />
        <Flex vertical flex={1} gap={8} style={{ minHeight: 0 }}>
          <div style={{ paddingInline: 12 }}>
            <Button block icon={<MessageSquarePlus size={16} />} onClick={onNewTopic}>
              开启新话题
            </Button>
          </div>
          <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }} viewStyle={{ paddingInline: 12 }}>
            <Flex vertical gap={8}>
              <Flex align='center' justify='space-between' gap={4} style={{ minHeight: 28, paddingInline: 8 }}>
                <Flex align='center' gap={5}>
                  话题
                  {topics.length ? (
                    <Text type='secondary' style={{ fontSize: 11 }}>
                      {topics.length}
                    </Text>
                  ) : null}
                </Flex>

                <Flex align='center' gap={2}>
                  <TopicFilter
                    groupMode={groupMode}
                    sortBy={sortBy}
                    onGroupModeChange={handleGroupModeChange}
                    onSortByChange={setSortBy}
                  />
                  <TopicActions
                    disabled={loading}
                    pageSize={pageSize}
                    totalCount={topics.length}
                    unfavoritedCount={unfavoritedCount}
                    onDelete={onDeleteTopics}
                    onPageSizeChange={setPageSize}
                  />
                </Flex>
              </Flex>
              <TopicList
                activeTopicId={activeTopicId}
                groupMode={groupMode}
                loading={loading}
                pageSize={pageSize}
                projectNames={projectNames}
                sortBy={sortBy}
                onDelete={onDeleteTopic}
                onFavorite={onFavoriteTopic}
                onProjectChange={onProjectChange}
                onRename={onRenameTopic}
                onSelect={onSelectTopic}
                topics={topics}
              />
            </Flex>
          </Scrollbar>
        </Flex>
      </Flex>
    )
  }
)

TopicSidebar.displayName = 'TopicSidebar'

export default TopicSidebar
