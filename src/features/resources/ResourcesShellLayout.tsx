'use client'

import { Flex } from '@pure/ui'
import type { CSSProperties, ReactNode } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'
import { sidebarResizeStyles, useSidebarResize } from '@/layout/sidebarResize'

const ResourcesShellLayout = ({
  children,
  innerSidebar,
  sidebarCollapsed = false,
}: {
  children: ReactNode
  innerSidebar?: ReactNode
  sidebarCollapsed?: boolean
}) => {
  const { handleResizeStart, isResizing, sidebarWidth } = useSidebarResize()

  return (
    <Flex className='size-full overflow-hidden'>
      <div
        className={sidebarResizeStyles.sidebarWrapper}
        data-collapsed={sidebarCollapsed}
        data-resizing={isResizing}
        inert={sidebarCollapsed}
        style={
          {
            '--main-shell-sidebar-width': `${sidebarWidth}px`,
            width: sidebarCollapsed ? 0 : sidebarWidth,
          } as CSSProperties
        }
      >
        {innerSidebar}
      </div>
      <InsetContentFrame
        onResizeStart={sidebarCollapsed ? undefined : handleResizeStart}
        sidebarCollapsed={sidebarCollapsed}
      >
        <Flex className='h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>{children}</Flex>
      </InsetContentFrame>
    </Flex>
  )
}

export default ResourcesShellLayout
