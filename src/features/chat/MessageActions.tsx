'use client'

import { ActionIcon, DropdownMenu, Flexbox } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Copy, Edit, MoreHorizontal, Trash } from 'lucide-react'
import { memo, useMemo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  actions: css`
    margin-block-start: 4px;
    visibility: hidden;
    pointer-events: none;
  `,
  actionsVisible: css`
    visibility: visible;
    pointer-events: auto;
  `,
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
  const moreMenuItems = useMemo<MenuProps['items']>(
    () => [
      { icon: Copy, key: 'copy', label: '复制', onClick: onCopy },
      { icon: Edit, key: 'edit', label: '编辑', onClick: onEdit },
      { type: 'divider' },
      { danger: true, icon: Trash, key: 'delete', label: '删除', onClick: onDelete },
    ],
    [onCopy, onDelete, onEdit]
  )

  return (
    <Flexbox
      horizontal
      align='center'
      aria-hidden={isStreaming || undefined}
      className={cx(styles.actions, !isStreaming && styles.actionsVisible)}
      data-message-actions
      gap={2}
      justify={isUser ? 'flex-end' : 'flex-start'}
    >
      <ActionIcon icon={Copy} size='small' title='复制' onClick={onCopy} />
      <ActionIcon icon={Edit} size='small' title='编辑' onClick={onEdit} />
      <ActionIcon icon={Trash} size='small' title='删除' onClick={onDelete} />
      {/* <DropdownMenu items={moreMenuItems} placement={isUser ? 'bottomRight' : 'bottomLeft'}>
        <button className={styles.moreTrigger} title='更多' type='button'>
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu> */}
    </Flexbox>
  )
})

MessageActions.displayName = 'MessageActions'

export default MessageActions
