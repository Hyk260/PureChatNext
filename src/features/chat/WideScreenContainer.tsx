'use client'

import { Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo, type ReactNode } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

export const CONVERSATION_MAX_WIDTH = 960

const styles = createStaticStyles(({ css }) => ({
  container: css`
    flex-grow: 1;
    align-self: center;
    min-height: 0;
    transition: width 0.25s ${cssVar.motionEaseInOut};
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  `,
}))

type Props = {
  children: ReactNode
  className?: string
  maxWidth?: number
}

const WideScreenContainer = memo<Props>(({ children, className, maxWidth = CONVERSATION_MAX_WIDTH }) => {
  const wideScreen = useChatUiStore((s) => s.wideScreen)

  return (
    <Flexbox className={styles.wrapper}>
      <Flexbox
        className={cx(styles.container, className)}
        height='100%'
        paddingInline={16}
        style={{ width: wideScreen ? '100%' : `min(${maxWidth}px, 100%)` }}
      >
        {children}
      </Flexbox>
    </Flexbox>
  )
})

WideScreenContainer.displayName = 'WideScreenContainer'

export default WideScreenContainer
