'use client'

import {
  AccordionRoot,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Flex,
  Icon,
  Skeleton,
  Text,
} from '@pure/ui'
import { createStaticStyles, cssVar } from '@lobehub/ui'
import { Folder, Star } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import type { LocalChatTopic, TopicGroupMode, TopicPageSize, TopicSortBy } from '@/features/chat/types'

import ProjectGroupMenu from './ProjectGroupMenu'
import TopicItem from './TopicItem'
import { organizeTopics } from './topicGrouping'

const styles = createStaticStyles(({ css }) => ({
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
}))

const SKELETON_WIDTHS = [128, 164, 112, 148, 136, 156]

function getGroupTitleIcon(groupId: string, groupMode: TopicGroupMode) {
  if (groupId === 'favorite') {
    return <Icon color={cssVar.colorWarning} icon={Star} size={14} />
  }
  if (groupMode === 'byProject') {
    return <Icon color={cssVar.colorTextTertiary} icon={Folder} size={14} />
  }
  return null
}

type Props = {
  topics: LocalChatTopic[]
  autoRenameDisabled: boolean
  autoRenamingTopicId: string | null
  groupMode: TopicGroupMode
  loading: boolean
  pageSize: TopicPageSize
  projectNames: string[]
  sortBy: TopicSortBy
  activeTopicId: string | null
  onSelect: (topicId: string) => void
  onAutoRename: (id: string) => void | Promise<void>
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onFavorite: (id: string, favorite: boolean) => void | Promise<void>
  onProjectChange: (id: string, projectName: string | null) => void | Promise<void>
  onDeleteProject?: (projectName: string) => void | Promise<void>
  onNewTopicInProject?: (projectName: string) => void
}

const TopicList = memo<Props>(
  ({
    topics,
    autoRenameDisabled,
    autoRenamingTopicId,
    groupMode,
    loading,
    pageSize,
    projectNames,
    sortBy,
    activeTopicId,
    onSelect,
    onAutoRename,
    onRename,
    onDelete,
    onFavorite,
    onProjectChange,
    onDeleteProject,
    onNewTopicInProject,
  }) => {
    const [groupingNow] = useState(() => Date.now())
    const groups = useMemo(
      () => organizeTopics(topics, groupMode, sortBy, groupingNow, pageSize),
      [groupMode, groupingNow, pageSize, sortBy, topics]
    )

    const renderTopic = (topic: LocalChatTopic) => (
      <TopicItem
        active={activeTopicId === topic.id}
        autoRenameDisabled={autoRenameDisabled}
        autoRenaming={autoRenamingTopicId === topic.id}
        key={topic.id}
        projectNames={projectNames}
        topic={topic}
        onAutoRename={onAutoRename}
        onDelete={onDelete}
        onFavorite={onFavorite}
        onProjectChange={onProjectChange}
        onRename={onRename}
        onSelect={onSelect}
      />
    )

    if (loading) {
      return (
        <Flex className='flex-col gap-px'>
          {SKELETON_WIDTHS.map((width) => (
            <Flex className='items-center h-9 px-2.5' key={width}>
              <Skeleton animated height={16} width={width} />
            </Flex>
          ))}
        </Flex>
      )
    }

    if (topics.length === 0) {
      return (
        <Flex className='flex-col py-1 px-3'>
          <Text className={`${styles.empty} text-[12px]`}>暂无话题</Text>
        </Flex>
      )
    }

    if (groupMode === 'flat') {
      return <Flex className='flex-col gap-px'>{groups[0]?.topics.map(renderTopic)}</Flex>
    }

    const groupIds = groups.map((group) => group.id)
    return (
      <AccordionRoot
        multiple
        defaultValue={groupIds}
        style={{ gap: 2 }}
        key={`${groupMode}:${sortBy}`}
      >
        {groups.map((group) => {
          const projectName = group.id.startsWith('project:') ? group.id.slice('project:'.length) : null
          const showProjectMenu =
            groupMode === 'byProject' &&
            Boolean(projectName) &&
            (Boolean(onDeleteProject) || Boolean(onNewTopicInProject))

          return (
            <AccordionItem value={group.id} key={group.id}>
              <AccordionHeader style={{ paddingBlock: 4, paddingInline: '8px 4px' }}>
                <AccordionTrigger>
                  <Flex className='items-center gap-1.5 min-w-0'>
                    {getGroupTitleIcon(group.id, groupMode)}
                    <Text className='text-[12px] font-medium' ellipsis type='secondary'>
                      {group.title}
                    </Text>
                  </Flex>
                </AccordionTrigger>
                {showProjectMenu && projectName ? (
                  <ProjectGroupMenu
                    projectName={projectName}
                    topicCount={group.topics.length}
                    onDeleteProject={onDeleteProject}
                    onNewTopicInProject={onNewTopicInProject}
                  />
                ) : null}
              </AccordionHeader>
              <AccordionPanel>
                <Flex className='flex-col gap-px py-px'>{group.topics.map(renderTopic)}</Flex>
              </AccordionPanel>
            </AccordionItem>
          )
        })}
      </AccordionRoot>
    )
  }
)

TopicList.displayName = 'TopicList'

export default TopicList
