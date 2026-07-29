'use client'

import { Flex, Skeleton } from 'antd'
import { Accordion, AccordionItem, Icon, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Folder, Star } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import {
  type LocalChatTopic,
  type TopicGroupMode,
  type TopicPageSize,
  type TopicSortBy,
} from '@/features/chat/types'

import TopicItem from './TopicItem'
import { organizeTopics } from './topicGrouping'

const styles = createStaticStyles(({ css }) => ({
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  skeletonRow: css`
    display: flex;
    align-items: center;
    height: 36px;
    padding-inline: 10px;
  `,
}))

const SKELETON_WIDTHS = [128, 164, 112, 148, 136, 156]

type Props = {
  topics: LocalChatTopic[]
  groupMode: TopicGroupMode
  loading: boolean
  pageSize: TopicPageSize
  projectNames: string[]
  sortBy: TopicSortBy
  activeTopicId: string | null
  onSelect: (topicId: string) => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onFavorite: (id: string, favorite: boolean) => void | Promise<void>
  onProjectChange: (id: string, projectName: string | null) => void | Promise<void>
}

const TopicList = memo<Props>(
  ({
    topics,
    groupMode,
    loading,
    pageSize,
    projectNames,
    sortBy,
    activeTopicId,
    onSelect,
    onRename,
    onDelete,
    onFavorite,
    onProjectChange,
  }) => {
    const [groupingNow] = useState(() => Date.now())
    const groups = useMemo(
      () => organizeTopics(topics, groupMode, sortBy, groupingNow, pageSize),
      [groupMode, groupingNow, pageSize, sortBy, topics]
    )

    const renderTopic = (topic: LocalChatTopic) => (
      <TopicItem
        active={activeTopicId === topic.id}
        key={topic.id}
        projectNames={projectNames}
        topic={topic}
        onDelete={onDelete}
        onFavorite={onFavorite}
        onProjectChange={onProjectChange}
        onRename={onRename}
        onSelect={onSelect}
      />
    )

    if (loading) {
      return (
        <Flex vertical gap={1}>
          {SKELETON_WIDTHS.map((width) => (
            <div className={styles.skeletonRow} key={width}>
              <Skeleton.Input active size='small' style={{ height: 16, width }} />
            </div>
          ))}
        </Flex>
      )
    }

    if (topics.length === 0) {
      return (
        <Flex vertical style={{ paddingBlock: 4, paddingInline: 12 }}>
          <Text className={styles.empty} style={{ fontSize: 12 }}>
            暂无话题
          </Text>
        </Flex>
      )
    }

    if (groupMode === 'flat') {
      return (
        <Flex vertical gap={1}>
          {groups[0]?.topics.map(renderTopic)}
        </Flex>
      )
    }

    const groupIds = groups.map((group) => group.id)
    return (
      <Accordion defaultExpandedKeys={groupIds} gap={2} key={`${groupMode}:${sortBy}:${groupIds.join('|')}`}>
        {groups.map((group) => (
          <AccordionItem
            itemKey={group.id}
            key={group.id}
            paddingBlock={4}
            paddingInline='8px 4px'
            title={
              <Flex align='center' gap={6} style={{ minWidth: 0 }}>
                {group.id === 'favorite' ? (
                  <Icon color={cssVar.colorWarning} icon={Star} size={14} />
                ) : groupMode === 'byProject' ? (
                  <Icon color={cssVar.colorTextTertiary} icon={Folder} size={14} />
                ) : null}
                <Text ellipsis type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
                  {group.title}
                </Text>
              </Flex>
            }
          >
            <Flex vertical gap={1} style={{ paddingBlock: 1 }}>
              {group.topics.map(renderTopic)}
            </Flex>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }
)

TopicList.displayName = 'TopicList'

export default TopicList
