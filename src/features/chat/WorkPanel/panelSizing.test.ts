import { describe, expect, it } from 'vitest'

import { resizePanelWidths } from './panelSizing'

describe('work panel resizing', () => {
  it('moves the outside boundary while keeping the preview width', () => {
    const current = { panelWidth: 320, previewWidth: 400 }
    expect(resizePanelWidths(current, 80, 'panel', 1000, true)).toEqual({ panelWidth: 240, previewWidth: 400 })
    expect(resizePanelWidths(current, -200, 'panel', 1000, true)).toEqual({ panelWidth: 520, previewWidth: 400 })
    expect(resizePanelWidths(current, -1000, 'panel', 1000, true)).toEqual({ panelWidth: 600, previewWidth: 400 })
    expect(resizePanelWidths(current, 1000, 'panel', 1000, true).panelWidth).toBe(285)
  })

  it('shares the space between adjacent panels without moving the chat boundary', () => {
    const current = { panelWidth: 320, previewWidth: 560 }
    expect(resizePanelWidths(current, 100, 'preview', 1000, true)).toEqual({ panelWidth: 420, previewWidth: 460 })
    expect(resizePanelWidths(current, -1000, 'preview', 1000, true)).toEqual({ panelWidth: 285, previewWidth: 595 })
    expect(resizePanelWidths(current, 1000, 'preview', 1000, true)).toEqual({ panelWidth: 600, previewWidth: 280 })
  })

  it('bounds both panes in narrow windows', () => {
    expect(resizePanelWidths({ panelWidth: 200, previewWidth: 200 }, -100, 'preview', 400, true)).toEqual({
      panelWidth: 160,
      previewWidth: 240,
    })
    expect(resizePanelWidths({ panelWidth: 200, previewWidth: 200 }, -100, 'panel', 400, true)).toEqual({
      panelWidth: 200,
      previewWidth: 200,
    })
  })

  it('keeps the saved preview width when resizing the work panel on its own', () => {
    const current = { panelWidth: 320, previewWidth: 560 }
    expect(resizePanelWidths(current, -100, 'panel', 1000, false)).toEqual({ panelWidth: 420, previewWidth: 560 })
    expect(resizePanelWidths(current, -1000, 'panel', 1000, false).panelWidth).toBe(800)
    expect(resizePanelWidths(current, 100, 'preview', 1000, false)).toEqual(current)
  })
})
