'use client'

import { createStaticStyles } from 'antd-style'
import { Flexbox } from '@pure/ui'
import type { FlexboxProps } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

const CONVERSATION_MIN_WIDTH = 960

const styles = createStaticStyles(({ css }) => ({
  container: css`
    flex-grow: 1;
    align-self: center;
  `,
}))

interface WideScreenContainerProps extends FlexboxProps {
  children: ReactNode
}

const WideScreenContainer = memo<WideScreenContainerProps>(({ children, style, ...rest }) => {
  return (
    <Flexbox style={{ width: '100%' }}>
      <Flexbox
        className={styles.container}
        {...rest}
        style={{ paddingInline: 16, width: `min(${CONVERSATION_MIN_WIDTH}px, 100%)`, ...style }}
      >
        {children}
      </Flexbox>
    </Flexbox>
  )
})

WideScreenContainer.displayName = 'WideScreenContainer'

export default WideScreenContainer
