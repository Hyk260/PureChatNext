'use client'

import { Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo, type ReactNode } from 'react'

import ChatHeader from '@/features/chat/ChatHeader'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

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
  left: ReactNode
  right: ReactNode
  title: string
  children: ReactNode
}

const ChatLayout = memo<Props>(({ left, right, title, children }) => {
  const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)

  return (
    <Flexbox horizontal height='100dvh' width='100%' style={{ overflow: 'hidden' }}>
      <aside
        className={cx(styles.left, leftCollapsed && styles.leftCollapsed)}
        style={{ width: leftCollapsed ? 0 : LEFT_WIDTH }}
      >
        <div style={{ height: '100%', width: LEFT_WIDTH }}>{left}</div>
      </aside>
      <Flexbox className={styles.main} height='100%' style={{ minWidth: 0 }}>
        <ChatHeader title={title} />
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
})

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
