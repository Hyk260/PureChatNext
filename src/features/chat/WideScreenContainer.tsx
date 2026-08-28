'use client'

import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Flex } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

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
  wrapperCompact: css`
    flex: none;
    height: auto;
  `,
}))

type Props = {
  children: ReactNode
  className?: string
  fill?: boolean
  maxWidth?: number
}

const WideScreenContainer = memo<Props>(({ children, className, fill = true, maxWidth = CONVERSATION_MAX_WIDTH }) => {
  const wideScreen = useChatUiStore((s) => s.wideScreen)

  return (
    <Flex className={[cx(styles.wrapper, !fill && styles.wrapperCompact), 'flex-col']}>
      <Flex
        className={[cx(styles.container, className), 'flex-col px-4']}
        style={{ height: fill ? '100%' : 'auto', width: wideScreen ? '100%' : `min(${maxWidth}px, 100%)` }}
      >
        {children}
      </Flex>
    </Flex>
  )
})

WideScreenContainer.displayName = 'WideScreenContainer'

export default WideScreenContainer
