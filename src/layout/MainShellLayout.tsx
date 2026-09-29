'use client'

import { Flex } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import { useEffect, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import Scrollbar from '@/components/Scrollbar'
import { DESKTOP_SIDEBAR_STATE_EVENT, DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/features/desktop/desktopEvents'
import type { DesktopSidebarStateDetail } from '@/features/desktop/desktopEvents'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import InsetContentFrame from '@/layout/InsetContentFrame'

interface MainShellLayoutProps {
  children: ReactNode
  header?: ReactNode
  /** 是否由外壳提供统一滚动；关闭后由子页面自行管理滚动区域 */
  scrollable?: boolean
  sidebar: ReactNode
}

const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 160
const MAX_SIDEBAR_WIDTH = 420

const styles = createStaticStyles(({ css }) => ({
  sidebarWrapper: css`
    position: relative;
    flex: none;
    min-width: 0;
    height: 100%;
    overflow: hidden;

    & > * {
      width: var(--main-shell-sidebar-width) !important;
    }

    & > * > * {
      width: 100% !important;
    }
  `,
  resizeHandle: css`
    position: absolute;
    z-index: 1;
    top: 0;
    right: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  `,
}))

const MainShellLayout = ({ children, header, scrollable = true, sidebar }: MainShellLayoutProps) => {
  const sidebarCollapsed = useHomeStore((state) => state.sidebarCollapsed)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)

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

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)))
    }
    const handlePointerUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <Flex className='h-full w-full overflow-hidden'>
      <div
        className={styles.sidebarWrapper}
        style={
          {
            '--main-shell-sidebar-width': sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
            width: sidebarCollapsed ? 0 : sidebarWidth,
          } as CSSProperties
        }
      >
        {sidebar}
        {!sidebarCollapsed ? <div className={styles.resizeHandle} onPointerDown={handleResizeStart} /> : null}
      </div>
      <InsetContentFrame sidebarCollapsed={sidebarCollapsed}>
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
