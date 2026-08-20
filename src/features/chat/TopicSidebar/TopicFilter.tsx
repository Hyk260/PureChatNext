'use client'

import { ActionIcon, DropdownMenu, Icon } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { Check, ListFilter } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import type { TopicGroupMode, TopicSortBy } from '@/features/chat/types'

type Props = {
  groupMode: TopicGroupMode
  sortBy: TopicSortBy
  onGroupModeChange: (mode: TopicGroupMode) => void
  onSortByChange: (sortBy: TopicSortBy) => void
}

const TopicFilter = memo<Props>(({ groupMode, sortBy, onGroupModeChange, onSortByChange }) => {
  const [open, setOpen] = useState(false)
  const items = useMemo<MenuProps['items']>(
    () => [
      {
        children: [['byTime', '按时间'] as const, ['byProject', '按项目'] as const, ['flat', '平铺'] as const].map(
          ([value, label]) => ({
            icon: value === groupMode ? <Icon icon={Check} /> : <span />,
            key: `group-${value}`,
            label,
            onClick: () => onGroupModeChange(value),
          })
        ),
        key: 'organize',
        label: '整理',
        type: 'group',
      },
      { type: 'divider' },
      {
        children: [['createdAt', '按创建时间'] as const, ['updatedAt', '按更新时间'] as const].map(
          ([value, label]) => ({
            icon: value === sortBy ? <Icon icon={Check} /> : <span />,
            key: `sort-${value}`,
            label,
            onClick: () => onSortByChange(value),
          })
        ),
        key: 'sort',
        label: '排序',
        type: 'group',
      },
    ],
    [groupMode, onGroupModeChange, onSortByChange, sortBy]
  )

  return (
    <DropdownMenu items={items} open={open} placement='bottomLeft' onOpenChange={setOpen}>
      <ActionIcon icon={<Icon icon={ListFilter} />} size='small' title='整理话题' />
    </DropdownMenu>
  )
})

TopicFilter.displayName = 'TopicFilter'

export default TopicFilter
