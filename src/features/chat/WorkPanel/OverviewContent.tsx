'use client'

import { Text, Flex } from '@pure/ui'
import { formatDateTime } from '@pure/utils/client'
import { memo, useMemo } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

type Props = {
  topic: LocalChatTopic | null
  topicTitle: string
}

const OverviewContent = memo<Props>(({ topic, topicTitle }) => {
  const rows = useMemo(() => {
    const items: { label: string; value: string }[] = [{ label: '话题', value: topicTitle || '新话题' }]
    if (topic?.projectName) items.push({ label: '项目', value: topic.projectName })
    else items.push({ label: '项目', value: '未绑定项目' })
    if (topic) {
      items.push({ label: '创建时间', value: formatDateTime(topic.createdAt) })
      items.push({ label: '更新时间', value: formatDateTime(topic.updatedAt) })
    }
    return items
  }, [topic, topicTitle])

  return (
    <Flex className='flex-col gap-3 p-4 min-h-0 overflow-auto'>
      <Text className='font-medium'>会话概览</Text>
      <Flex className='flex-col gap-2'>
        {rows.map((row) => (
          <Flex className='flex-between gap-3' key={row.label}>
            <Text type='secondary'>{row.label}</Text>
            <Text className='text-right' ellipsis>
              {row.value}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  )
})

OverviewContent.displayName = 'OverviewContent'

export default OverviewContent
