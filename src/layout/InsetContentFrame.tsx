import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { getDesktopApi } from '@/types/desktop'

const InsetContentFrame = ({
  children,
  onResizeStart,
  sidebarCollapsed = false,
}: {
  children: ReactNode
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void
  sidebarCollapsed?: boolean
}) => {
  const isDesktop = Boolean(getDesktopApi())
  const padding = sidebarCollapsed ? 'p-2' : 'p-2 ps-0'

  return (
    <div className={`relative min-h-0 min-w-0 flex-1 bg-app-layout ${padding}${isDesktop ? ' pt-0' : ''}`}>
      {onResizeStart ? (
        <div
          aria-hidden='true'
          className='absolute inset-y-0 start-0 z-10 w-2 cursor-ew-resize'
          onPointerDown={onResizeStart}
        />
      ) : null}
      <div className='flex h-full min-h-0 min-w-0 overflow-hidden rounded-lg border border-app-border-secondary bg-app-surface'>
        {children}
      </div>
    </div>
  )
}

export default InsetContentFrame
