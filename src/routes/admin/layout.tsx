'use client'

import { Flex } from '@pure/ui'
import type { ReactNode } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'
import RequireAdmin from '@/spa/auth/RequireAdmin'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function AdminRouteLayout({ children }: { children?: ReactNode }) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <Flex className='size-full min-h-0 flex-col'>
          <InsetContentFrame sidebarCollapsed>
            <div className='size-full min-h-0 overflow-hidden'>{children}</div>
          </InsetContentFrame>
        </Flex>
      </RequireAdmin>
    </RequireAuth>
  )
}
