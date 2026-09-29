'use client'

import { Flex } from '@pure/ui'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { DESKTOP_SIDEBAR_STATE_EVENT, DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/features/desktop/desktopEvents'
import type { DesktopSidebarStateDetail } from '@/features/desktop/desktopEvents'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import InsetContentFrame from '@/layout/InsetContentFrame'

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
      {innerSidebar}
      <InsetContentFrame sidebarCollapsed={sidebarCollapsed}>
        <Flex className='h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>{children}</Flex>
      </InsetContentFrame>
    </Flex>
  )
}

export default ResourcesShellLayout
