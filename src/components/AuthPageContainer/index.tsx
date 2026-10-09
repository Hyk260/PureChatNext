'use client'

import { Flex } from '@pure/ui'
import type { PropsWithChildren } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'

export const AuthPageContainer = ({ children }: PropsWithChildren) => {
  return (
    <Flex className='h-full min-h-0 w-full flex-col'>
      <InsetContentFrame sidebarCollapsed>
        <Flex className='h-full min-h-0 w-full flex-col overflow-y-auto'>
          <Flex className='flex-1 flex-col'>
            <div aria-hidden className='h-14 shrink-0 md:h-16' />
            <Flex className='flex-center flex-1 px-6 pb-10 md:px-10'>{children}</Flex>
            <div aria-hidden className='h-10 shrink-0 md:h-12' />
          </Flex>
        </Flex>
      </InsetContentFrame>
    </Flex>
  )
}
