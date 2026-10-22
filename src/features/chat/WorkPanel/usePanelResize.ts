import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  COMPACT_LAYOUT_WIDTH,
  DEFAULT_FILE_PREVIEW_WIDTH,
  DEFAULT_WORK_PANEL_WIDTH,
  MIN_CHAT_WIDTH,
  resizePanelWidths,
} from './panelSizing'
import type { PanelWidths, ResizeBoundary } from './panelSizing'

type LayoutState = PanelWidths & { setWidths: (widths: PanelWidths) => void }

export const useWorkPanelLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      panelWidth: DEFAULT_WORK_PANEL_WIDTH,
      previewWidth: DEFAULT_FILE_PREVIEW_WIDTH,
      setWidths: (widths) => set(widths),
    }),
    {
      name: 'purechat:layout:work-panel',
      partialize: ({ panelWidth, previewWidth }) => ({ panelWidth, previewWidth }),
    }
  )
)

type DragState = {
  boundary: ResizeBoundary
  cursor: string
  maxTotalWidth: number
  previewOpen: boolean
  selection: string
  startX: number
  widths: PanelWidths
}

export function usePanelResize(previewOpen: boolean) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const setWidths = useWorkPanelLayoutStore((state) => state.setWidths)

  const readLayout = useCallback(() => {
    const root = rootRef.current
    const panel = panelRef.current
    const container = root?.closest('aside')?.parentElement
    if (!root || !panel || !container) return null
    const reserved = window.innerWidth <= COMPACT_LAYOUT_WIDTH ? 0 : MIN_CHAT_WIDTH
    return {
      maxTotalWidth: Math.max(0, container.clientWidth - reserved - 1),
      widths: {
        panelWidth: panel.getBoundingClientRect().width,
        previewWidth: previewOpen
          ? (previewRef.current?.getBoundingClientRect().width ?? 0)
          : useWorkPanelLayoutStore.getState().previewWidth,
      },
    }
  }, [previewOpen])

  const finishResize = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    document.body.style.cursor = drag.cursor
    document.body.style.userSelect = drag.selection
    dragRef.current = null
    setIsResizing(false)
  }, [])

  useEffect(() => {
    const dragState = dragRef
    return () => {
      const drag = dragState.current
      if (!drag) return
      document.body.style.cursor = drag.cursor
      document.body.style.userSelect = drag.selection
    }
  }, [])

  const startResize = (boundary: ResizeBoundary, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const layout = readLayout()
    if (!layout) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
    dragRef.current = {
      ...layout,
      boundary,
      cursor: document.body.style.cursor,
      previewOpen,
      selection: document.body.style.userSelect,
      startX: event.clientX,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    setIsResizing(true)
  }

  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setWidths(
      resizePanelWidths(drag.widths, event.clientX - drag.startX, drag.boundary, drag.maxTotalWidth, drag.previewOpen)
    )
  }

  const resizeWithKeyboard = (boundary: ResizeBoundary, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const layout = readLayout()
    if (!layout) return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const delta = direction * (event.shiftKey ? 50 : 10)
    setWidths(resizePanelWidths(layout.widths, delta, boundary, layout.maxTotalWidth, previewOpen))
  }

  const separatorProps = (boundary: ResizeBoundary) => ({
    'aria-label': boundary === 'panel' ? '调整工作面板宽度' : '调整文件内容预览宽度',
    'aria-orientation': 'vertical' as const,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => resizeWithKeyboard(boundary, event),
    onLostPointerCapture: finishResize,
    onPointerCancel: finishResize,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => startResize(boundary, event),
    onPointerMove: moveResize,
    onPointerUp: finishResize,
    role: 'separator',
    tabIndex: 0,
  })

  return { isResizing, panelRef, previewRef, rootRef, separatorProps }
}
