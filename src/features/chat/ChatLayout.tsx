'use client'

import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Flexbox } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

import ChatHeader from '@/features/chat/ChatHeader'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic } from '@/features/chat/types'

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
    height: 100dvh;
    overflow: hidden;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    transition:
      width 0.25s ${cssVar.motionEaseInOut},
      border-color 0.25s ${cssVar.motionEaseInOut};
  `,
  leftCollapsed: css`
    width: 0 !important;
    border-inline-end-color: transparent;
  `,
  main: css`
    flex: 1;
    min-width: 0;
    height: 100dvh;
  `,
  right: css`
    flex: none;
    width: ${RIGHT_WIDTH}px;
    min-width: 0;
    height: 100dvh;
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

    return (
      <Flexbox horizontal style={{ height: '100dvh', width: '100%', overflow: 'hidden' }}>
        <aside
          className={cx(styles.left, leftCollapsed && styles.leftCollapsed)}
          style={{ width: leftCollapsed ? 0 : LEFT_WIDTH }}
        >
          <div style={{ height: '100%', width: LEFT_WIDTH }}>{left}</div>
        </aside>
        <Flexbox className={styles.main} style={{ height: '100%', minWidth: 0 }}>
          <ChatHeader
            autoRenameDisabled={busy || autoRenamingTopicId !== null}
            autoRenaming={topic?.id === autoRenamingTopicId}
            title={title}
            topic={topic}
            onAutoRename={onAutoRenameTopic}
            onDelete={onDeleteTopic}
            onFavorite={onFavoriteTopic}
            onRename={onRenameTopic}
          />
          <div className={styles.content}>{children}</div>
        </Flexbox>
        <aside
          className={cx(styles.right, rightCollapsed && styles.rightCollapsed)}
          style={{ width: rightCollapsed ? 0 : RIGHT_WIDTH }}
        >
          <div style={{ height: '100%', width: RIGHT_WIDTH }}>{right}</div>
        </aside>
      </Flexbox>
    )
  }
)

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
