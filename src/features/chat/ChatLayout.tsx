'use client'

import { Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, type ReactNode } from 'react'

import ChatHeader from '@/features/chat/ChatHeader'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

const styles = createStaticStyles(({ css }) => ({
  content: css`
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  `,
  left: css`
    flex: none;
    width: 260px;
    height: 100dvh;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    overflow: auto;
  `,
  main: css`
    flex: 1;
    min-width: 0;
    height: 100dvh;
  `,
  right: css`
    flex: none;
    width: 320px;
    height: 100dvh;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    overflow: auto;
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
    <Flexbox horizontal height='100dvh' width='100%'>
      {!leftCollapsed ? <aside className={styles.left}>{left}</aside> : null}
      <Flexbox className={styles.main} height='100%' style={{ minWidth: 0 }}>
        <ChatHeader title={title} />
        <div className={styles.content}>{children}</div>
      </Flexbox>
      {!rightCollapsed ? <aside className={styles.right}>{right}</aside> : null}
    </Flexbox>
  )
})

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
