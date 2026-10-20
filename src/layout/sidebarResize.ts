import { createStaticStyles } from '@lobehub/ui'
import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEFAULT_SIDEBAR_WIDTH = 240
export const MIN_SIDEBAR_WIDTH = 220
export const MAX_SIDEBAR_WIDTH = 400
export const SIDEBAR_TRANSITION = '0.25s cubic-bezier(0.22, 1, 0.36, 1)'

interface SidebarLayoutState {
  isResizing: boolean
  sidebarWidth: number
  setIsResizing: (isResizing: boolean) => void
  setSidebarWidth: (width: number) => void
}

export const useSidebarLayoutStore = create<SidebarLayoutState>()(
  persist(
    (set) => ({
      isResizing: false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      setIsResizing: (isResizing) => set({ isResizing }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
    }),
    {
      name: 'purechat:layout:sidebar',
      partialize: ({ sidebarWidth }) => ({ sidebarWidth }),
    }
  )
)

export const sidebarResizeStyles = createStaticStyles(({ css }) => ({
  // Keep the inner width stable during collapse so content scales without reflowing.
  sidebarWrapper: css`
    position: relative;
    flex: none;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    transition: width ${SIDEBAR_TRANSITION};

    & > * {
      width: var(--main-shell-sidebar-width) !important;
      transform: scale(1);
      transform-origin: left center;
      opacity: 1;
      transition:
        transform ${SIDEBAR_TRANSITION},
        opacity ${SIDEBAR_TRANSITION};
    }

    & > * > * {
      width: 100% !important;
    }

    &[data-collapsed='true'] > * {
      transform: scale(0.94);
      opacity: 0;
    }

    &[data-resizing='true'] {
      transition: none;
    }

    @media (prefers-reduced-motion: reduce) {
      &,
      & > * {
        transition: none;
      }
    }
  `,
  contentFrame: css`
    transition: padding-inline-start ${SIDEBAR_TRANSITION};

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
}))

export const useSidebarResize = () => {
  const sidebarWidth = useSidebarLayoutStore((state) => state.sidebarWidth)
  const setSidebarWidth = useSidebarLayoutStore((state) => state.setSidebarWidth)
  const isResizing = useSidebarLayoutStore((state) => state.isResizing)
  const setIsResizing = useSidebarLayoutStore((state) => state.setIsResizing)

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsResizing(true)
      const startX = event.clientX
      const startWidth = sidebarWidth

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + moveEvent.clientX - startX
        setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)))
      }
      const handlePointerUp = () => {
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
        document.removeEventListener('pointercancel', handlePointerUp)
      }

      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp, { once: true })
      document.addEventListener('pointercancel', handlePointerUp, { once: true })
    },
    [setIsResizing, setSidebarWidth, sidebarWidth]
  )

  return { handleResizeStart, isResizing, sidebarWidth }
}
