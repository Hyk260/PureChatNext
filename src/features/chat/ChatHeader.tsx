'use client'

import { ActionIcon, confirmModal, copyToClipboard, DropdownMenu, Icon, Input, Modal, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import {
  Hash,
  Maximize2,
  MoreHorizontal,
  PanelLeftOpen,
  PanelRightOpen,
  Pencil,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic } from '@/features/chat/types'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 40px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  menuTrigger: css`
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
  title: css`
    min-width: 0;
    margin-inline-start: 4px;
    font-size: 14px;
    font-weight: 600;
  `,
}))

type Props = {
  autoRenameDisabled: boolean
  autoRenaming: boolean
  title: string
  topic: LocalChatTopic | null
  onAutoRename: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onFavorite: (id: string, favorite: boolean) => void | Promise<void>
  onRename: (id: string, title: string) => void | Promise<void>
}

const ChatHeader = memo<Props>(
  ({ autoRenameDisabled, autoRenaming, title, topic, onAutoRename, onDelete, onFavorite, onRename }) => {
    const { message } = useApp()
    const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
    const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
    const wideScreen = useChatUiStore((s) => s.wideScreen)
    const toggleLeftCollapsed = useChatUiStore((s) => s.toggleLeftCollapsed)
    const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)
    const toggleWideScreen = useChatUiStore((s) => s.toggleWideScreen)
    const [renameOpen, setRenameOpen] = useState(false)
    const [draftTitle, setDraftTitle] = useState('')
    const [saving, setSaving] = useState(false)

    const handleOpenRename = useCallback(() => {
      if (!topic) return
      setDraftTitle(topic.title)
      setRenameOpen(true)
    }, [topic])

    const handleRename = async () => {
      if (!topic || saving) return
      const nextTitle = draftTitle.trim()
      if (!nextTitle) return

      setSaving(true)
      try {
        await onRename(topic.id, nextTitle)
        setRenameOpen(false)
      } finally {
        setSaving(false)
      }
    }

    const handleAutoRename = useCallback(() => {
      if (!topic || autoRenameDisabled) return
      void onAutoRename(topic.id)
    }, [autoRenameDisabled, onAutoRename, topic])

    const handleCopyId = useCallback(async () => {
      if (!topic) return
      try {
        await copyToClipboard(topic.id)
        message.success('会话 ID 已复制')
      } catch (error) {
        console.error('[chat] copy topic id failed', error)
        message.error('复制会话 ID 失败')
      }
    }, [message, topic])

    const handleDelete = useCallback(() => {
      if (!topic) return
      confirmModal({
        cancelText: '取消',
        content: '话题下的所有消息将一并删除。',
        okButtonProps: { danger: true },
        okText: '删除',
        onOk: () => onDelete(topic.id),
        title: '删除该话题？',
      })
    }, [onDelete, topic])

    const menuItems = useMemo(
      () => [
        ...(topic
          ? [
              {
                icon: <Icon icon={Star} />,
                key: 'favorite',
                label: topic.favorite ? '取消收藏' : '收藏',
                onClick: () => void onFavorite(topic.id, !topic.favorite),
              },
              { type: 'divider' as const },
              {
                disabled: autoRenameDisabled,
                icon: <Icon icon={Sparkles} />,
                key: 'auto-rename',
                label: autoRenaming ? '正在智能重命名…' : '智能重命名',
                onClick: handleAutoRename,
              },
              {
                icon: <Icon icon={Pencil} />,
                key: 'rename',
                label: '重命名',
                onClick: handleOpenRename,
              },
              { type: 'divider' as const },
              {
                icon: <Icon icon={Hash} />,
                key: 'copy-session-id',
                label: '复制会话 ID',
                onClick: () => void handleCopyId(),
              },
              { type: 'divider' as const },
            ]
          : []),
        {
          checked: wideScreen,
          icon: <Icon icon={Maximize2} />,
          key: 'full-width',
          label: '全宽显示',
          onCheckedChange: (checked: boolean) => toggleWideScreen(checked),
          type: 'switch' as const,
        },
        ...(topic
          ? [
              { type: 'divider' as const },
              {
                danger: true,
                icon: <Icon icon={Trash2} />,
                key: 'delete',
                label: '删除',
                onClick: handleDelete,
              },
            ]
          : []),
      ],
      [
        autoRenaming,
        autoRenameDisabled,
        handleAutoRename,
        handleCopyId,
        handleDelete,
        handleOpenRename,
        onFavorite,
        toggleWideScreen,
        topic,
        wideScreen,
      ]
    )

    return (
      <>
        <Flex className={[styles.header, 'flex-between']}>
          <Flex className='flex-row items-center flex-1 gap-1 min-w-[0px] overflow-hidden'>
            {leftCollapsed ? (
              <ActionIcon icon={PanelLeftOpen} size='small' title='展开话题栏' onClick={toggleLeftCollapsed} />
            ) : null}
            <Text className={styles.title} ellipsis>
              {title}
            </Text>
            <DropdownMenu
              items={menuItems}
              nativeButton
              placement='bottomLeft'
              triggerProps={{ className: styles.menuTrigger, title: '更多' }}
            >
              <MoreHorizontal size={16} />
              <span className={styles.srOnly}>更多</span>
            </DropdownMenu>
          </Flex>

          <Flex className='flex-row items-center flex-none gap-0.5'>
            {rightCollapsed ? (
              <ActionIcon icon={PanelRightOpen} size='small' title='展开工作面板' onClick={toggleRightCollapsed} />
            ) : null}
          </Flex>
        </Flex>

        <Modal
          cancelText='取消'
          confirmLoading={saving}
          destroyOnHidden
          okButtonProps={{ disabled: !draftTitle.trim() }}
          okText='保存'
          open={renameOpen}
          title='重命名话题'
          width={400}
          onCancel={() => setRenameOpen(false)}
          onOk={handleRename}
        >
          <Flex className='flex-col gap-3 py-2'>
            <Text type='secondary'>保持简短且易于识别。</Text>
            <Input
              autoFocus
              maxLength={100}
              placeholder='话题名称'
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onPressEnter={handleRename}
            />
          </Flex>
        </Modal>
      </>
    )
  }
)

ChatHeader.displayName = 'ChatHeader'

export default ChatHeader
