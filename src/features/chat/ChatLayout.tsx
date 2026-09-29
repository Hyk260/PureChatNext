'use client'

import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Flex } from '@pure/ui'
import { memo, useEffect } from 'react'
import type { ReactNode } from 'react'

import ChatHeader from '@/features/chat/ChatHeader'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic } from '@/features/chat/types'
import { DESKTOP_SIDEBAR_STATE_EVENT, DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/features/desktop/desktopEvents'
import type { DesktopSidebarStateDetail } from '@/features/desktop/desktopEvents'
import InsetContentFrame from '@/layout/InsetContentFrame'

const LEFT_WIDTH = 240
const RIGHT_WIDTH = 320

const styles = createStaticStyles(({ css }) => ({
  content: css`
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  `,
  left: css`
    flex: none;
    width: ${LEFT_WIDTH}px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    transition: width 0.25s ${cssVar.motionEaseInOut};
  `,
  leftCollapsed: css`
    width: 0 !important;
  `,
  main: css`
    flex: 1;
    min-width: 0;
    height: 100%;
  `,
  right: css`
    flex: none;
    width: ${RIGHT_WIDTH}px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    transition:
      width 0.25s ${cssVar.motionEaseInOut},
      border-color 0.25s ${cssVar.motionEaseInOut};
  `,
  rightCollapsed: css`
    width: 0 !important;
    border-inline-start-color: transparent;
  `,
}))

type Props = {
  autoRenamingTopicId: string | null
  busy: boolean
  hasMessages: boolean
  left: ReactNode
  right: ReactNode
  topic: LocalChatTopic | null
  title: string
  children: ReactNode
  onAutoRenameTopic: (id: string) => void | Promise<void>
  onDeleteTopic: (id: string) => void | Promise<void>
  onFavoriteTopic: (id: string, favorite: boolean) => void | Promise<void>
  onRenameTopic: (id: string, title: string) => void | Promise<void>
}

const ChatLayout = memo<Props>(
  ({
    autoRenamingTopicId,
    busy,
    hasMessages,
    left,
    right,
    topic,
    title,
    children,
    onAutoRenameTopic,
    onDeleteTopic,
    onFavoriteTopic,
    onRenameTopic,
  }) => {
    const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
    const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)

    useEffect(() => {
      const handleToggle = () => useChatUiStore.getState().toggleLeftCollapsed()
      window.addEventListener(DESKTOP_TOGGLE_SIDEBAR_EVENT, handleToggle)
      return () => window.removeEventListener(DESKTOP_TOGGLE_SIDEBAR_EVENT, handleToggle)
    }, [])

    useEffect(() => {
      window.dispatchEvent(
        new CustomEvent<DesktopSidebarStateDetail>(DESKTOP_SIDEBAR_STATE_EVENT, {
          detail: { collapsed: leftCollapsed },
        })
      )
    }, [leftCollapsed])

    return (
      <Flex className='h-full w-full overflow-hidden'>
        <aside className={cx(styles.left, leftCollapsed && styles.leftCollapsed)}>
          <Flex className='h-full w-[240px]'>{left}</Flex>
        </aside>
        <InsetContentFrame sidebarCollapsed={leftCollapsed}>
          <Flex className={[styles.main, 'h-full min-w-0 flex-col']}>
            <ChatHeader
              autoRenameDisabled={busy || autoRenamingTopicId !== null}
              autoRenaming={topic?.id === autoRenamingTopicId}
              hasMessages={hasMessages}
              title={title}
              topic={topic}
              onAutoRename={onAutoRenameTopic}
              onDelete={onDeleteTopic}
              onFavorite={onFavoriteTopic}
              onRename={onRenameTopic}
            />
            <div className={styles.content}>{children}</div>
          </Flex>
          <aside className={cx(styles.right, rightCollapsed && styles.rightCollapsed)}>
            <Flex className='h-full w-[320px]'>{right}</Flex>
          </aside>
        </InsetContentFrame>
      </Flex>
    )
  }
)

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
