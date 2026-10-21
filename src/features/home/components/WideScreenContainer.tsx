'use client'

import { Flex } from '@pure/ui'
import type { FlexProps } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

const CONVERSATION_MIN_WIDTH = 960

interface WideScreenContainerProps extends FlexProps {
  children: ReactNode
}

const WideScreenContainer = memo<WideScreenContainerProps>(({ children, style, ...rest }) => {
  return (
    <Flex className='flex-col flex-none h-auto w-full'>
      <Flex
        className={['grow self-center @container', 'flex-col px-4']}
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
