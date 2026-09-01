'use client'

import { ActionIcon, Button, Text, Flex } from '@pure/ui'
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
  onDeleteProject?: (projectName: string) => void | Promise<void>
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
    onDeleteProject,
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
      <Flex className='flex-col gap-2 h-full overflow-hidden w-[240px]'>
        <SideBarHeaderLayout
          collapsed={leftCollapsed}
          left={
            <Flex className='flex-row items-center flex-1 gap-0.5 min-w-0'>
              <ActionIcon icon={ChevronLeft} size='small' title='返回首页' onClick={() => router.push('/')} />
              <AgentSwitcher agents={agents} currentAgentId={currentAgentId} onSelect={onAgentSelect} />
            </Flex>
          }
          showHomeIcon={false}
          onToggleCollapsed={toggleLeftCollapsed}
        />
        <Flex className='flex-col flex-1 gap-2 min-h-0'>
          <div style={{ paddingInline: 12 }}>
            <Button block icon={<MessageSquarePlus size={16} />} type='fill' onClick={onNewTopic}>
              开启新话题
            </Button>
          </div>
          <Scrollbar viewStyle={{ paddingInline: 12 }}>
            <Flex className='flex-col gap-2'>
              <Flex className='flex-between gap-1 min-h-[28px] px-2'>
                <Flex className='flex-row items-center gap-[5px]'>
                  话题
                  {topics.length ? (
                    <Text type='secondary' style={{ fontSize: 11 }}>
                      {topics.length}
                    </Text>
                  ) : null}
                </Flex>

                <Flex className='flex-row items-center gap-0.5'>
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
                </Flex>
              </Flex>
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
                onDeleteProject={onDeleteProject}
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
