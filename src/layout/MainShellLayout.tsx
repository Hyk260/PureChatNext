'use client'

import { Flex } from '@pure/ui'
import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import Scrollbar from '@/components/Scrollbar'
import { DESKTOP_SIDEBAR_STATE_EVENT, DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/features/desktop/desktopEvents'
import type { DesktopSidebarStateDetail } from '@/features/desktop/desktopEvents'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import InsetContentFrame from '@/layout/InsetContentFrame'
import { sidebarResizeStyles, useSidebarResize } from '@/layout/sidebarResize'

interface MainShellLayoutProps {
  children: ReactNode
  header?: ReactNode
  /** 是否由外壳提供统一滚动；关闭后由子页面自行管理滚动区域 */
  scrollable?: boolean
  sidebar: ReactNode
}

const MainShellLayout = ({ children, header, scrollable = true, sidebar }: MainShellLayoutProps) => {
  const sidebarCollapsed = useHomeStore((state) => state.sidebarCollapsed)
  const { handleResizeStart, sidebarWidth } = useSidebarResize()

  useEffect(() => {
    const handleToggle = () => useHomeStore.getState().toggleSidebarCollapsed()
    window.addEventListener(DESKTOP_TOGGLE_SIDEBAR_EVENT, handleToggle)
    return () => window.removeEventListener(DESKTOP_TOGGLE_SIDEBAR_EVENT, handleToggle)
  }, [])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<DesktopSidebarStateDetail>(DESKTOP_SIDEBAR_STATE_EVENT, {
        detail: { collapsed: sidebarCollapsed },
      })
    )
  }, [sidebarCollapsed])

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
        {sidebar}
      </div>
      <InsetContentFrame
        onResizeStart={sidebarCollapsed ? undefined : handleResizeStart}
        sidebarCollapsed={sidebarCollapsed}
      >
        <Flex className='relative min-h-0 min-w-0 flex-1 flex-col'>
          {header}
          {scrollable ? (
            <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }}>{children}</Scrollbar>
          ) : (
            <Flex className='min-h-0 w-full flex-1 flex-col overflow-hidden'>{children}</Flex>
          )}
        </Flex>
      </InsetContentFrame>
    </Flex>
  )
}

export default MainShellLayout
