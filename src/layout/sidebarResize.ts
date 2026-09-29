import { createStaticStyles } from 'antd-style'
import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEFAULT_SIDEBAR_WIDTH = 240
export const MIN_SIDEBAR_WIDTH = 160
export const MAX_SIDEBAR_WIDTH = 420

interface SidebarLayoutState {
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
}

export const useSidebarLayoutStore = create<SidebarLayoutState>()(
  persist(
    (set) => ({
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
    }),
    { name: 'purechat:layout:sidebar' }
  )
)

export const sidebarResizeStyles = createStaticStyles(({ css }) => ({
  // Keep the dynamic sidebar width and nested fixed-width layout in one selector.
  sidebarWrapper: css`
    position: relative;
    flex: none;
    min-width: 0;
    height: 100%;
    overflow: hidden;

    & > * {
      width: var(--main-shell-sidebar-width) !important;
      transition: none !important;
    }

    & > * > * {
      width: 100% !important;
    }
  `,
}))

export const useSidebarResize = () => {
  const sidebarWidth = useSidebarLayoutStore((state) => state.sidebarWidth)
  const setSidebarWidth = useSidebarLayoutStore((state) => state.setSidebarWidth)

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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
    },
    [setSidebarWidth, sidebarWidth]
  )

  return { handleResizeStart, sidebarWidth }
}
