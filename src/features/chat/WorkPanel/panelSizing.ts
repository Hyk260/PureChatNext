export const DEFAULT_WORK_PANEL_WIDTH = 320
export const DEFAULT_FILE_PREVIEW_WIDTH = 560
export const MIN_WORK_PANEL_WIDTH = 220
export const MIN_FILE_PREVIEW_WIDTH = 280
export const MAX_WORK_PANEL_WIDTH = 800
export const MIN_CHAT_WIDTH = 280
export const COMPACT_LAYOUT_WIDTH = 900
export const PANEL_ANIMATION_DURATION = 0.25
export const PANEL_ANIMATION_EASE = [0.22, 1, 0.36, 1] as const
export const PANEL_TRANSITION = '0.25s cubic-bezier(0.22, 1, 0.36, 1)'

export type PanelWidths = { panelWidth: number; previewWidth: number }
export type ResizeBoundary = 'panel' | 'preview'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function resizePanelWidths(
  current: PanelWidths,
  delta: number,
  boundary: ResizeBoundary,
  maxTotalWidth: number,
  previewOpen: boolean
): PanelWidths {
  if (boundary === 'preview' && !previewOpen) return current
  if (boundary === 'preview') {
    const total = current.panelWidth + current.previewWidth
    const minPanel = Math.min(MIN_WORK_PANEL_WIDTH, total * 0.4)
    const minPreview = Math.min(MIN_FILE_PREVIEW_WIDTH, total * 0.5)
    const panelWidth = clamp(current.panelWidth + delta, minPanel, Math.min(MAX_WORK_PANEL_WIDTH, total - minPreview))
    return { panelWidth, previewWidth: total - panelWidth }
  }

  const maxPanel = Math.max(0, Math.min(MAX_WORK_PANEL_WIDTH, maxTotalWidth - (previewOpen ? current.previewWidth : 0)))
  const minPanel = Math.min(MIN_WORK_PANEL_WIDTH, maxPanel)
  return { panelWidth: clamp(current.panelWidth - delta, minPanel, maxPanel), previewWidth: current.previewWidth }
}
