'use client'

import { Flex } from '@pure/ui'
import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { DESKTOP_SIDEBAR_STATE_EVENT, DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/features/desktop/desktopEvents'
import type { DesktopSidebarStateDetail } from '@/features/desktop/desktopEvents'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import InsetContentFrame from '@/layout/InsetContentFrame'
import { sidebarResizeStyles, useSidebarResize } from '@/layout/sidebarResize'

const ResourcesShellLayout = ({
  children,
  innerSidebar,
  sidebarCollapsed = false,
  sidebarCollapsible = false,
}: {
  children: ReactNode
  innerSidebar?: ReactNode
  sidebarCollapsed?: boolean
  sidebarCollapsible?: boolean
}) => {
  const { handleResizeStart, sidebarWidth } = useSidebarResize()

  useEffect(() => {
    if (!sidebarCollapsible) return
    const handleToggle = () => useHomeStore.getState().toggleSidebarCollapsed()
    window.addEventListener(DESKTOP_TOGGLE_SIDEBAR_EVENT, handleToggle)
    return () => window.removeEventListener(DESKTOP_TOGGLE_SIDEBAR_EVENT, handleToggle)
  }, [sidebarCollapsible])

  useEffect(() => {
    if (!sidebarCollapsible) return
    window.dispatchEvent(
      new CustomEvent<DesktopSidebarStateDetail>(DESKTOP_SIDEBAR_STATE_EVENT, {
        detail: { collapsed: sidebarCollapsed },
      })
    )
  }, [sidebarCollapsed, sidebarCollapsible])

  return (
    <Flex className='h-full w-full overflow-hidden'>
      <div
        className={sidebarResizeStyles.sidebarWrapper}
        style={
          {
            '--main-shell-sidebar-width': sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
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
