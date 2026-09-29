import type { ReactNode } from 'react'

import { getDesktopApi } from '@/types/desktop'

const InsetContentFrame = ({
  children,
  sidebarCollapsed = false,
}: {
  children: ReactNode
  sidebarCollapsed?: boolean
}) => {
  const isDesktop = Boolean(getDesktopApi())
  const padding = sidebarCollapsed ? 'p-2' : 'p-2 ps-0'

  return (
    <div className={`min-h-0 min-w-0 flex-1 bg-app-layout ${padding}${isDesktop ? ' pt-0' : ''}`}>
      <div className='flex h-full min-h-0 min-w-0 overflow-hidden rounded-lg border border-app-border-secondary bg-app-surface'>
        {children}
      </div>
    </div>
  )
}

export default InsetContentFrame
