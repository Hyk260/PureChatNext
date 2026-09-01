'use client'

import { Text, Flex } from '@pure/ui'
import { memo, useMemo } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

type Props = {
  topic: LocalChatTopic | null
  topicTitle: string
}

function formatTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const OverviewContent = memo<Props>(({ topic, topicTitle }) => {
  const rows = useMemo(() => {
    const items: { label: string; value: string }[] = [{ label: '话题', value: topicTitle || '新话题' }]
    if (topic?.projectName) items.push({ label: '项目', value: topic.projectName })
    else items.push({ label: '项目', value: '未绑定项目' })
    if (topic) {
      items.push({ label: '创建时间', value: formatTime(topic.createdAt) })
      items.push({ label: '更新时间', value: formatTime(topic.updatedAt) })
    }
    return items
  }, [topic, topicTitle])

  return (
    <Flex className='flex-col gap-3 p-4 min-h-0 overflow-auto'>
      <Text style={{ fontWeight: 500 }}>会话概览</Text>
      <Flex className='flex-col gap-2'>
        {rows.map((row) => (
          <Flex className='flex-between gap-3' key={row.label}>
            <Text type='secondary'>{row.label}</Text>
            <Text ellipsis style={{ textAlign: 'right' }}>
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
