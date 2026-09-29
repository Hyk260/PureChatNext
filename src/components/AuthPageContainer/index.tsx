'use client'

import type { PropsWithChildren } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'

export const AuthPageContainer = ({ children }: PropsWithChildren) => {
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <InsetContentFrame sidebarCollapsed>
        <div className='flex h-full min-h-0 w-full flex-col overflow-y-auto'>
          <div className='flex flex-1 flex-col'>
            <div aria-hidden className='h-14 shrink-0 md:h-16' />
            <div className='flex flex-1 items-center justify-center px-6 pb-10 md:px-10'>{children}</div>
            <div aria-hidden className='h-10 shrink-0 md:h-12' />
          </div>
        </div>
      </InsetContentFrame>
    </div>
  )
}
