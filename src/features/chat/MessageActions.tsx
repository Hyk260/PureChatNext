'use client'

import { ActionIcon, DropdownMenu, Flex } from '@pure/ui'
import type { DropdownItem } from '@pure/ui'
import { createStaticStyles, cssVar } from '@lobehub/ui'
import { Copy, Edit, MoreHorizontal, Trash } from 'lucide-react'
import { memo, useMemo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  moreTrigger: css`
    cursor: pointer;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 6px;

    color: ${cssVar.colorTextSecondary};
    background: transparent;
    outline: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
}))

interface MessageActionsProps {
  isStreaming?: boolean
  isUser: boolean
  onCopy: () => void
  onDelete: () => void
  onEdit: () => void
}

const MessageActions = memo<MessageActionsProps>(({ isStreaming, isUser, onCopy, onDelete, onEdit }) => {
  const moreMenuItems = useMemo<DropdownItem[]>(
    () => [
      { icon: Copy, key: 'copy', label: '复制', onClick: onCopy },
      { icon: Edit, key: 'edit', label: '编辑', onClick: onEdit },
      { type: 'divider' },
      { danger: true, icon: Trash, key: 'delete', label: '删除', onClick: onDelete },
    ],
    [onCopy, onDelete, onEdit]
  )

  return (
    <Flex
      aria-hidden={isStreaming || undefined}
      className={[
        'mt-1 items-center gap-0.5',
        isStreaming ? 'invisible pointer-events-none' : 'visible pointer-events-auto',
        isUser ? 'justify-end' : 'justify-start',
      ]}
      data-message-actions
    >
      <ActionIcon aria-label='复制' icon={Copy} size='small' title='复制' onClick={onCopy} />
      <ActionIcon aria-label='编辑' icon={Edit} size='small' title='编辑' onClick={onEdit} />
      <ActionIcon aria-label='删除' icon={Trash} size='small' title='删除' onClick={onDelete} />
      {/* <DropdownMenu items={moreMenuItems} placement={isUser ? 'bottomRight' : 'bottomLeft'}>
        <button className={styles.moreTrigger} title='更多' type='button'>
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu> */}
    </Flex>
  )
})

MessageActions.displayName = 'MessageActions'

export default MessageActions
