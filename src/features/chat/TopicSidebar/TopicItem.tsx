'use client'

import type { MenuInfo, MenuProps } from '@lobehub/ui'
import { Block, DropdownMenu, Flexbox, Icon, Input, Modal, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Copy, Link, MoreHorizontal, Pencil, Sparkles, Star, Trash2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'
import { confirmModal } from '@/libs/modal'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    cursor: pointer;
    user-select: none;

    & .topic-actions {
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }

    &:hover .topic-actions,
    & .topic-actions[data-open='true'] {
      opacity: 1;
      pointer-events: auto;
    }
  `,
  srOnly: css`
    position: absolute;

    overflow: hidden;
    clip: rect(0, 0, 0, 0);

    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;

    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;

    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;

    color: ${cssVar.colorTextSecondary};
    background: transparent;
    outline: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
}))

const stopMenuEvent = (info: MenuInfo) => {
  const event = info.domEvent as { stopPropagation?: () => void } | undefined
  event?.stopPropagation?.()
}

type Props = {
  active: boolean
  topic: LocalChatTopic
  onSelect: (topicId: string) => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
}

const TopicItem = memo<Props>(({ active, topic, onSelect, onRename, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(topic.title)
  const [saving, setSaving] = useState(false)

  const handleOpenRename = useCallback(() => {
    setDraftTitle(topic.title)
    setRenameOpen(true)
  }, [topic.title])

  const handleSubmitRename = async () => {
    const next = draftTitle.trim()
    if (!next || saving) return

    setSaving(true)
    try {
      await onRename(topic.id, next)
      setRenameOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        icon: <Icon icon={Star} />,
        key: 'favorite',
        label: '收藏',
        onClick: stopMenuEvent,
      },
      {
        icon: <Icon icon={Sparkles} />,
        key: 'smart-rename',
        label: '智能重命名',
        onClick: stopMenuEvent,
      },
      {
        icon: <Icon icon={Pencil} />,
        key: 'rename',
        label: '重命名',
        onClick: (info) => {
          stopMenuEvent(info)
          handleOpenRename()
        },
      },
      { type: 'divider' },
      {
        icon: <Icon icon={Copy} />,
        key: 'copy',
        label: '复制',
        onClick: stopMenuEvent,
      },
      {
        icon: <Icon icon={Link} />,
        key: 'copy-link',
        label: '复制链接',
        onClick: stopMenuEvent,
      },
      { type: 'divider' },
      {
        danger: true,
        icon: <Icon icon={Trash2} />,
        key: 'delete',
        label: '删除',
        onClick: (info) => {
          stopMenuEvent(info)
          confirmModal({
            cancelText: '取消',
            content: '话题下的所有消息将一并删除。',
            okButtonProps: { danger: true },
            okText: '删除',
            onOk: () => onDelete(topic.id),
            title: '删除该话题？',
          })
        },
      },
    ],
    [handleOpenRename, onDelete, topic.id],
  )

  return (
    <>
      <Block
        className={styles.item}
        paddingBlock={8}
        paddingInline={10}
        variant={active ? 'filled' : 'borderless'}
        onClick={() => onSelect(topic.id)}
      >
        <Flexbox align='center' gap={4} horizontal>
          <Text
            color={active ? cssVar.colorText : cssVar.colorTextSecondary}
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={topic.title}
          >
            {topic.title}
          </Text>
          <Flexbox
            align='center'
            className={cx('topic-actions')}
            data-open={menuOpen || undefined}
            horizontal
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {/*
              Multiple children avoid DropdownMenu cloning a single element and
              reading element.ref (removed in React 19).
            */}
            <DropdownMenu
              items={menuItems}
              nativeButton
              open={menuOpen}
              placement='bottomLeft'
              triggerProps={{ className: styles.trigger, title: '更多' }}
              onOpenChange={setMenuOpen}
            >
              <Icon icon={MoreHorizontal} size='small' />
              <span className={styles.srOnly}>更多</span>
            </DropdownMenu>
          </Flexbox>
        </Flexbox>
      </Block>

      <Modal
        confirmLoading={saving}
        open={renameOpen}
        title='重命名话题'
        onCancel={() => setRenameOpen(false)}
        onOk={() => void handleSubmitRename()}
      >
        <Input
          onChange={(event) => setDraftTitle(event.target.value)}
          onPressEnter={() => void handleSubmitRename()}
          placeholder='话题名称'
          value={draftTitle}
        />
      </Modal>
    </>
  )
})

TopicItem.displayName = 'TopicItem'

export default TopicItem
