'use client'

import type { ReactNode } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'
import RequireAdmin from '@/spa/auth/RequireAdmin'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function AdminRouteLayout({ children }: { children?: ReactNode }) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <div className='flex h-full min-h-0 w-full flex-col'>
          <InsetContentFrame sidebarCollapsed>
            <div className='h-full min-h-0 w-full overflow-hidden'>{children}</div>
          </InsetContentFrame>
        </div>
      </RequireAdmin>
    </RequireAuth>
  )
}
