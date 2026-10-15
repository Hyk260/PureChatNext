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
        <Flex className='h-full min-h-0 w-full flex-col'>
          <InsetContentFrame sidebarCollapsed>
            <div className='h-full min-h-0 w-full overflow-hidden'>{children}</div>
          </InsetContentFrame>
        </Flex>
      </RequireAdmin>
    </RequireAuth>
  )
}
