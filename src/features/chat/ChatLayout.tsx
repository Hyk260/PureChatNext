'use client'

import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import type { UIMessage } from 'ai'
import { memo } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import ChatHeader from '@/features/chat/ChatHeader'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic } from '@/features/chat/types'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import InsetContentFrame from '@/layout/InsetContentFrame'
import { sidebarResizeStyles, useSidebarResize } from '@/layout/sidebarResize'

const RIGHT_WIDTH = 320

const styles = createStaticStyles(({ css }) => ({
  content: css`
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
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
}))

type Props = {
  autoRenamingTopicId: string | null
  busy: boolean
  hasMessages: boolean
  messages: UIMessage[]
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
    messages,
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
    const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
    const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
    const { handleResizeStart, isResizing, sidebarWidth } = useSidebarResize()

    return (
      <Flex className='size-full overflow-hidden bg-app-layout'>
        <div
          className={sidebarResizeStyles.sidebarWrapper}
          data-collapsed={sidebarCollapsed}
          data-resizing={isResizing}
          inert={sidebarCollapsed}
          style={
            {
              '--main-shell-sidebar-width': `${sidebarWidth}px`,
              width: sidebarCollapsed ? 0 : sidebarWidth,
            } as CSSProperties
          }
        >
          <Flex className='size-full flex-col overflow-hidden'>{left}</Flex>
        </div>
        <InsetContentFrame
          onResizeStart={sidebarCollapsed ? undefined : handleResizeStart}
          sidebarCollapsed={sidebarCollapsed}
        >
          <Flex className='flex-1 min-w-0 h-full flex-col'>
            <ChatHeader
              autoRenameDisabled={busy || autoRenamingTopicId !== null}
              autoRenaming={topic?.id === autoRenamingTopicId}
              hasMessages={hasMessages}
              messages={messages}
              title={title}
              topic={topic}
              onAutoRename={onAutoRenameTopic}
              onDelete={onDeleteTopic}
              onFavorite={onFavoriteTopic}
              onRename={onRenameTopic}
            />
            <div className={styles.content}>{children}</div>
          </Flex>
          <aside className={cx(styles.right, rightCollapsed && '!w-0 !border-s-transparent')}>
            <Flex className='h-full w-[320px]'>{right}</Flex>
          </aside>
        </InsetContentFrame>
      </Flex>
    )
  }
)

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
