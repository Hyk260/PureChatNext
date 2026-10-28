'use client'

import { ActionIconGroup, cx } from '@lobehub/ui'
import { Copy, Edit, Trash } from 'lucide-react'
import { memo, useMemo } from 'react'

const createActionIcon = (Icon: typeof Copy, label: string) => <Icon aria-label={label} role='img' size={14} />

interface MessageActionsProps {
  isStreaming?: boolean
  onCopy: () => void
  onDelete: () => void
  onEdit: () => void
}

interface MessageActionItem {
  danger?: boolean
  icon: ReturnType<typeof createActionIcon>
  key: string
  label: string
  onClick: () => void
}

const MessageActions = memo<MessageActionsProps>(({ isStreaming, onCopy, onDelete, onEdit }) => {
  const actionItems = useMemo<MessageActionItem[]>(
    () => [
      { icon: createActionIcon(Copy, '复制'), key: 'copy', label: '复制', onClick: onCopy },
      { icon: createActionIcon(Edit, '编辑'), key: 'edit', label: '编辑', onClick: onEdit },
      { danger: true, icon: createActionIcon(Trash, '删除'), key: 'delete', label: '删除', onClick: onDelete },
    ],
    [onCopy, onDelete, onEdit]
  )

  return (
    <ActionIconGroup
      aria-hidden={isStreaming || undefined}
      className={cx(
        'shrink-0',
        isStreaming ? 'invisible pointer-events-none' : 'visible pointer-events-auto',
      )}
      data-message-actions
      items={actionItems}
      size='small'
      variant='borderless'
    />
  )
})

MessageActions.displayName = 'MessageActions'

export default MessageActions
