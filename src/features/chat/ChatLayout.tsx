'use client'

import { ActionIcon, Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { memo } from 'react'
import type { ReactNode } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

const styles = createStaticStyles(({ css }) => ({
  left: css`
    flex: none;
    width: 260px;
    height: 100dvh;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    overflow: auto;
  `,
  leftToggle: css`
    position: absolute;
    inset-block-start: 12px;
    inset-inline-start: 12px;
    z-index: 2;
  `,
  main: css`
    flex: 1;
    min-width: 0;
    height: 100dvh;
    position: relative;
  `,
  right: css`
    flex: none;
    width: 320px;
    height: 100dvh;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    overflow: auto;
  `,
  rightToggle: css`
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 12px;
    z-index: 2;
  `,
}))

type Props = {
  left: ReactNode
  right: ReactNode
  children: ReactNode
}

const ChatLayout = memo<Props>(({ left, right, children }) => {
  const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
  const toggleLeftCollapsed = useChatUiStore((s) => s.toggleLeftCollapsed)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)

  return (
    <Flexbox horizontal height='100dvh' width='100%'>
      {!leftCollapsed ? <aside className={styles.left}>{left}</aside> : null}
      <div className={styles.main}>
        <ActionIcon
          className={styles.leftToggle}
          icon={leftCollapsed ? PanelLeftOpen : PanelLeftClose}
          title={leftCollapsed ? '展开话题栏' : '折叠话题栏'}
          onClick={toggleLeftCollapsed}
        />
        <ActionIcon
          className={styles.rightToggle}
          icon={rightCollapsed ? PanelRightOpen : PanelRightClose}
          title={rightCollapsed ? '展开参数栏' : '折叠参数栏'}
          onClick={toggleRightCollapsed}
        />
        {children}
      </div>
      {!rightCollapsed ? <aside className={styles.right}>{right}</aside> : null}
    </Flexbox>
  )
})

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
