'use client'

import { ActionIcon, Button, Text, Flexbox } from '@pure/ui'
import { ChevronLeft, MessageSquarePlus } from 'lucide-react'
import { useRouter } from '@/utils/navigation'
import { memo, useMemo } from 'react'

import Scrollbar from '@/components/Scrollbar'
import type { AgentListItem } from '@/const/home/agents'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic, TopicDeleteScope } from '@/features/chat/types'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import AgentSwitcher from './AgentSwitcher'
import TopicActions from './TopicActions'
import TopicFilter from './TopicFilter'
import TopicList from './TopicList'

type Props = {
  agents: AgentListItem[]
  autoRenameDisabled: boolean
  autoRenamingTopicId: string | null
  currentAgentId: string
  loading: boolean
  topics: LocalChatTopic[]
  activeTopicId: string | null
  onAgentSelect: (agent: AgentListItem) => void
  onAutoRenameTopic: (id: string) => void | Promise<void>
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
    autoRenameDisabled,
    autoRenamingTopicId,
    currentAgentId,
    loading,
    topics,
    activeTopicId,
    onAgentSelect,
    onAutoRenameTopic,
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
    const groupMode = useChatUiStore((s) => s.topicGroupMode)
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
    const unfavoritedCount = useMemo(() => topics.filter((topic) => !topic.favorite).length, [topics])

    return (
      <Flexbox gap={8} style={{ height: '100%', overflow: 'hidden', width: 240 }}>
        <SideBarHeaderLayout
          collapsed={leftCollapsed}
          left={
            <Flexbox horizontal align='center' flex={1} gap={2} style={{ minWidth: 0 }}>
              <ActionIcon icon={ChevronLeft} size='small' title='返回首页' onClick={() => router.push('/')} />
              <AgentSwitcher agents={agents} currentAgentId={currentAgentId} onSelect={onAgentSelect} />
            </Flexbox>
          }
          showHomeIcon={false}
          onToggleCollapsed={toggleLeftCollapsed}
        />
        <Flexbox flex={1} gap={8} style={{ minHeight: 0 }}>
          <div style={{ paddingInline: 12 }}>
            <Button block color='default' variant='filled' icon={<MessageSquarePlus size={16} />} onClick={onNewTopic}>
              开启新话题
            </Button>
          </div>
          <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }} viewStyle={{ paddingInline: 12 }}>
            <Flexbox gap={8}>
              <Flexbox
                horizontal
                align='center'
                justify='space-between'
                gap={4}
                style={{ minHeight: 28, paddingInline: 8 }}
              >
                <Flexbox horizontal align='center' gap={5}>
                  话题
                  {topics.length ? (
                    <Text type='secondary' style={{ fontSize: 11 }}>
                      {topics.length}
                    </Text>
                  ) : null}
                </Flexbox>

                <Flexbox horizontal align='center' gap={2}>
                  <TopicFilter
                    groupMode={groupMode}
                    sortBy={sortBy}
                    onGroupModeChange={setGroupMode}
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
                </Flexbox>
              </Flexbox>
              <TopicList
                activeTopicId={activeTopicId}
                autoRenameDisabled={autoRenameDisabled}
                autoRenamingTopicId={autoRenamingTopicId}
                groupMode={groupMode}
                loading={loading}
                pageSize={pageSize}
                projectNames={projectNames}
                sortBy={sortBy}
                onAutoRename={onAutoRenameTopic}
                onDelete={onDeleteTopic}
                onFavorite={onFavoriteTopic}
                onProjectChange={onProjectChange}
                onRename={onRenameTopic}
                onSelect={onSelectTopic}
                topics={topics}
              />
            </Flexbox>
          </Scrollbar>
        </Flexbox>
      </Flexbox>
    )
  }
)

TopicSidebar.displayName = 'TopicSidebar'

export default TopicSidebar
