import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  useSidebarLayoutStore,
  useSidebarResize,
} from './sidebarResize'

function ResizeHandle() {
  const { handleResizeStart } = useSidebarResize()
  return <div data-testid='resize-handle' onPointerDown={handleResizeStart} />
}

afterEach(() => {
  fireEvent.pointerCancel(document)
  useSidebarLayoutStore.setState({ isResizing: false, sidebarWidth: DEFAULT_SIDEBAR_WIDTH })
  localStorage.clear()
})

describe('sidebar resizing', () => {
  it('disables motion only while dragging, clamps width and persists only the width', () => {
    render(<ResizeHandle />)
    const handle = screen.getByTestId('resize-handle')

    fireEvent.pointerDown(handle, { clientX: 240 })
    expect(useSidebarLayoutStore.getState().isResizing).toBe(true)
    fireEvent.pointerMove(document, { clientX: 280 })
    expect(useSidebarLayoutStore.getState().sidebarWidth).toBe(280)
    fireEvent.pointerMove(document, { clientX: 1000 })
    expect(useSidebarLayoutStore.getState().sidebarWidth).toBe(MAX_SIDEBAR_WIDTH)
    fireEvent.pointerMove(document, { clientX: 0 })
    expect(useSidebarLayoutStore.getState().sidebarWidth).toBe(MIN_SIDEBAR_WIDTH)
    fireEvent.pointerUp(document)
    expect(useSidebarLayoutStore.getState().isResizing).toBe(false)
    expect(document.body.style.cursor).toBe('')

    fireEvent.pointerMove(document, { clientX: 320 })
    expect(useSidebarLayoutStore.getState().sidebarWidth).toBe(MIN_SIDEBAR_WIDTH)

    fireEvent.pointerDown(handle, { clientX: 220 })
    fireEvent.pointerCancel(document)
    expect(useSidebarLayoutStore.getState().isResizing).toBe(false)
    expect(JSON.parse(localStorage.getItem('purechat:layout:sidebar')!).state).toEqual({
      sidebarWidth: MIN_SIDEBAR_WIDTH,
    })
  })
})
