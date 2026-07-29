'use client'

import { ActionIcon, type MenuProps, DropdownMenu, Icon } from '@pure/ui'
import { Check, Hash, MoreHorizontal, Trash2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { type TopicDeleteScope, type TopicPageSize } from '@/features/chat/types'

const PAGE_SIZES: TopicPageSize[] = [20, 40, 60, 100]

type Props = {
  disabled?: boolean
  pageSize: TopicPageSize
  totalCount: number
  unfavoritedCount: number
  onDelete: (scope: TopicDeleteScope) => void | Promise<void>
  onPageSizeChange: (pageSize: TopicPageSize) => void
}

const TopicActions = memo<Props>(
  ({ disabled, pageSize, totalCount, unfavoritedCount, onDelete, onPageSizeChange }) => {
    const { modal } = useApp()
    const [open, setOpen] = useState(false)

    const confirmDelete = useCallback(
      (scope: TopicDeleteScope) => {
        const deleteAll = scope === 'all'
        const count = deleteAll ? totalCount : unfavoritedCount
        setOpen(false)
        modal.confirm({
          cancelText: '取消',
          content: deleteAll
            ? `当前助理下的 ${count} 个话题及其消息将全部删除，此操作无法撤销。`
            : `将删除当前助理下 ${count} 个未收藏话题及其消息，已收藏话题会保留。`,
          okButtonProps: { danger: true },
          okText: deleteAll ? '删除全部话题' : '删除未收藏话题',
          title: deleteAll ? '删除全部话题？' : '删除未收藏话题？',
          onOk: () => onDelete(scope),
        })
      },
      [modal, onDelete, totalCount, unfavoritedCount]
    )

    const items = useMemo<MenuProps['items']>(
      () => [
        {
          children: PAGE_SIZES.map((size) => ({
            icon: pageSize === size ? <Icon icon={Check} /> : <span />,
            key: `page-size-${size}`,
            label: `${size} 个条目`,
            onClick: () => onPageSizeChange(size),
          })),
          icon: <Icon icon={Hash} />,
          key: 'page-size',
          label: '显示条目',
        },
        { type: 'divider' },
        {
          disabled: unfavoritedCount === 0,
          icon: <Icon icon={Trash2} />,
          key: 'delete-unfavorited',
          label: '删除未收藏话题',
          onClick: () => confirmDelete('unfavorited'),
        },
        {
          danger: true,
          disabled: totalCount === 0,
          icon: <Icon icon={Trash2} />,
          key: 'delete-all',
          label: '删除全部话题',
          onClick: () => confirmDelete('all'),
        },
      ],
      [confirmDelete, onPageSizeChange, pageSize, totalCount, unfavoritedCount]
    )

    return (
      <DropdownMenu items={items} open={open} placement='bottomLeft' onOpenChange={setOpen}>
        <ActionIcon disabled={disabled} icon={MoreHorizontal} size='small' title='更多话题操作' />
      </DropdownMenu>
    )
  }
)

TopicActions.displayName = 'TopicActions'

export default TopicActions
