'use client'

import type { ReactNode } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'

export default function DevRouteLayout({ children }: { children?: ReactNode }) {
  return (
    <div className='flex size-full min-h-0 flex-col'>
      <InsetContentFrame sidebarCollapsed>
        <div className='size-full min-h-0 overflow-hidden'>{children}</div>
      </InsetContentFrame>
    </div>
  )
}
