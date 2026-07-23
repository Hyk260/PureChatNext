'use client'

import { Flex, type FlexProps } from 'antd'
import { createStaticStyles } from 'antd-style'
import { memo, type ReactNode } from 'react'

const CONVERSATION_MIN_WIDTH = 960

const styles = createStaticStyles(({ css }) => ({
  container: css`
    flex-grow: 1;
    align-self: center;
  `,
}))

interface WideScreenContainerProps extends FlexProps {
  children: ReactNode
}

const WideScreenContainer = memo<WideScreenContainerProps>(({ children, style, ...rest }) => {
  return (
    <Flex vertical style={{ width: '100%' }}>
      <Flex
        vertical
        className={styles.container}
        {...rest}
        style={{ paddingInline: 16, width: `min(${CONVERSATION_MIN_WIDTH}px, 100%)`, ...style }}
      >
        {children}
      </Flex>
    </Flex>
  )
})

WideScreenContainer.displayName = 'WideScreenContainer'

export default WideScreenContainer
