'use client'

import type { ReactNode } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'

export default function DevRouteLayout({ children }: { children?: ReactNode }) {
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <InsetContentFrame sidebarCollapsed>
        <div className='h-full min-h-0 w-full overflow-hidden'>{children}</div>
      </InsetContentFrame>
    </div>
  )
}
