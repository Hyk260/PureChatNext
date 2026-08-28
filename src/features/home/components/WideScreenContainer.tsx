'use client'

import { createStaticStyles } from 'antd-style'
import { Flex } from '@pure/ui'
import type { FlexProps } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

const CONVERSATION_MIN_WIDTH = 960

const styles = createStaticStyles(({ css }) => ({
  container: css`
    flex-grow: 1;
    align-self: center;
    container-type: inline-size;
  `,
}))

interface WideScreenContainerProps extends FlexProps {
  children: ReactNode
}

const WideScreenContainer = memo<WideScreenContainerProps>(({ children, style, ...rest }) => {
  return (
    <Flex className='flex-col flex-none h-auto w-full'>
      <Flex
        className={[styles.container, 'flex-col px-4']}
        {...rest}
        style={{ width: `min(${CONVERSATION_MIN_WIDTH}px, 100%)`, ...style }}
      >
        {children}
      </Flex>
    </Flex>
  )
})

WideScreenContainer.displayName = 'WideScreenContainer'

export default WideScreenContainer
