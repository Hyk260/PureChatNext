'use client'

import { ActionIcon, Button, DropdownMenu, Icon, Modal, Text, Flex } from '@pure/ui'
import { copyToClipboard } from '@pure/utils/client'
import { toast, createStaticStyles, cssVar } from '@lobehub/ui'
import type { UIMessage } from 'ai'
import {
  Check,
  Hash,
  Link2,
  Maximize2,
  MoreHorizontal,
  PanelLeftOpen,
  PanelRightOpen,
  Pencil,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import { createTopicShare } from '@/features/chat/chatApi'
import { getMessageText } from '@/features/chat/messageText'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic } from '@/features/chat/types'
import TopicRenameModal, { confirmDeleteTopic, useTopicRename } from '@/features/chat/TopicRenameModal'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { getDesktopApi } from '@/types/desktop'

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
  title: css`
    min-width: 0;
    margin-inline-start: 4px;
    font-size: 14px;
    font-weight: 600;
  `,
  // 保留 createStaticStyles：渐变遮罩让底部内容淡出并融入弹窗背景。
  sharePreviewFade: css`
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 64px;
    pointer-events: none;
    background: linear-gradient(to bottom, transparent, ${cssVar.colorBgElevated});
    mask-image: linear-gradient(to bottom, transparent, #000 85%);
  `,
}))

type Props = {
  autoRenameDisabled: boolean
  autoRenaming: boolean
  hasMessages: boolean
  messages: UIMessage[]
  title: string
  topic: LocalChatTopic | null
  onAutoRename: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onFavorite: (id: string, favorite: boolean) => void | Promise<void>
  onRename: (id: string, title: string) => void | Promise<void>
}

const ChatHeader = memo<Props>(
  ({ autoRenameDisabled, autoRenaming, hasMessages, messages, title, topic, onAutoRename, onDelete, onFavorite, onRename }) => {
    const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
    const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
    const wideScreen = useChatUiStore((s) => s.wideScreen)
    const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)
    const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)
    const toggleWideScreen = useChatUiStore((s) => s.toggleWideScreen)
    const rename = useTopicRename((title) => (topic ? onRename(topic.id, title) : undefined))
    const [shareOpen, setShareOpen] = useState(false)
    const [shareLoading, setShareLoading] = useState(false)
    const [shareUrl, setShareUrl] = useState('')
    const [shareCopied, setShareCopied] = useState(false)
    const sharePreviewMessages = useMemo(
      () =>
        messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => ({ id: message.id, isUser: message.role === 'user', text: getMessageText(message) }))
          .filter((message) => message.text.trim())
          .slice(0, 3),
      [messages]
    )

    const handleOpenRename = useCallback(() => {
      if (!topic) return
      rename.openRename(topic.title)
    }, [rename, topic])

    const handleAutoRename = useCallback(() => {
      if (!topic || autoRenameDisabled) return
      onAutoRename(topic.id)
    }, [autoRenameDisabled, onAutoRename, topic])

    const handleCopyId = useCallback(async () => {
      if (!topic) return
      try {
        await copyToClipboard(topic.id)
        toast.success('会话 ID 已复制')
      } catch (error) {
        console.error('[chat] copy topic id failed', error)
        toast.error('复制会话 ID 失败')
      }
    }, [topic])

    const handleShare = useCallback(async () => {
      if (!topic || shareLoading) return
      setShareOpen(true)
      setShareLoading(true)
      setShareUrl('')
      setShareCopied(false)
      try {
        const { shareId } = await createTopicShare(topic.id)
        setShareUrl(`${window.location.origin}/share/t/${shareId}`)
      } catch (error) {
        console.error('[chat] share failed', error)
        toast.error('生成分享链接失败')
      } finally {
        setShareLoading(false)
      }
    }, [shareLoading, topic])

    const handleCopyShareLink = useCallback(async () => {
      if (!shareUrl) return
      try {
        await copyToClipboard(shareUrl)
        setShareCopied(true)
        toast.success('分享链接已复制')
      } catch (error) {
        console.error('[chat] copy share link failed', error)
        toast.error('复制分享链接失败')
      }
    }, [shareUrl])

    const handleDelete = useCallback(() => {
      if (!topic) return
      confirmDeleteTopic(() => onDelete(topic.id))
    }, [onDelete, topic])

    const menuItems = useMemo(
      () => [
        ...(topic
          ? [
              {
                icon: <Icon icon={Star} />,
                key: 'favorite',
                label: topic.favorite ? '取消收藏' : '收藏',
                onClick: () => onFavorite(topic.id, !topic.favorite),
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
                onClick: handleCopyId,
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
          <Flex className='items-center flex-1 gap-1 min-w-0 overflow-hidden'>
            {sidebarCollapsed && !getDesktopApi() ? (
              <ActionIcon icon={PanelLeftOpen} size='small' title='展开话题栏' onClick={toggleSidebarCollapsed} />
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
              <span className='sr-only'>更多</span>
            </DropdownMenu>
          </Flex>

          <Flex className='items-center flex-none gap-0.5'>
            {hasMessages && topic ? (
              <ActionIcon icon={Share2} size='small' title='分享' onClick={handleShare} />
            ) : null}
            {rightCollapsed ? (
              <ActionIcon icon={PanelRightOpen} size='small' title='展开工作面板' onClick={toggleRightCollapsed} />
            ) : null}
          </Flex>
        </Flex>

        <TopicRenameModal
          open={rename.open}
          draftTitle={rename.draftTitle}
          saving={rename.saving}
          onDraftTitleChange={rename.setDraftTitle}
          onCancel={rename.close}
          onOk={rename.submit}
        />
        <Modal
          footer={null}
          open={shareOpen}
          title={`分享「${title}」`}
          width='min(92vw, 720px)'
          onCancel={() => setShareOpen(false)}
        >
          <Flex className='flex-col gap-5 pb-2'>
            <div className='relative h-56 overflow-hidden rounded-2xl border border-border'>
              <Flex className='flex-col gap-3 p-5'>
                {sharePreviewMessages.map((message) => (
                  <div
                    className={message.isUser ? 'max-w-[85%] self-end rounded-2xl bg-secondary px-4 py-3' : 'self-start'}
                    key={message.id}
                  >
                    <Text as='p' className='m-0 whitespace-pre-wrap break-words text-sm leading-6'>
                      {message.text}
                    </Text>
                  </div>
                ))}
              </Flex>
              <div aria-hidden='true' className={styles.sharePreviewFade} />
            </div>
            <Flex className='items-center justify-between gap-4'>
              <Text type='secondary'>任何知道此链接的人都可以查看此聊天</Text>
              <Button
                disabled={!shareUrl}
                icon={shareCopied ? <Check size={16} /> : <Link2 size={16} />}
                loading={shareLoading}
                onClick={handleCopyShareLink}
              >
                {shareCopied ? '已复制' : '复制链接'}
              </Button>
            </Flex>
          </Flex>
        </Modal>
      </>
    )
  }
)

ChatHeader.displayName = 'ChatHeader'

export default ChatHeader
