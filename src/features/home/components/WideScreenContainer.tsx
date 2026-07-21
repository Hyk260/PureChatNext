'use client'

import { type FlexboxProps, Flexbox } from '@lobehub/ui'
import { createStaticStyles } from 'antd-style'
import { memo, type ReactNode } from 'react'

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

const WideScreenContainer = memo<WideScreenContainerProps>(({ children, ...rest }) => {
  return (
    <Flexbox width='100%'>
      <Flexbox
        className={styles.container}
        paddingInline={16}
        width={`min(${CONVERSATION_MIN_WIDTH}px, 100%)`}
        {...rest}
      >
        {children}
      </Flexbox>
    </Flexbox>
  )
})

WideScreenContainer.displayName = 'WideScreenContainer'

export default WideScreenContainer
