import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEFAULT_TERMINAL_HEIGHT = 280

export function terminalHeightBounds(containerHeight: number) {
  const max = Math.max(0, Math.min(containerHeight * 0.7, containerHeight - 240))
  return { min: Math.min(160, max), max }
}

export function clampTerminalHeight(height: number, containerHeight: number) {
  const { min, max } = terminalHeightBounds(containerHeight)
  const safe = Number.isFinite(height) ? height : DEFAULT_TERMINAL_HEIGHT
  return Math.max(min, Math.min(max, safe))
}

interface TerminalPanelState {
  available: boolean
  open: boolean
  height: number
  setAvailable: (available: boolean) => void
  toggle: () => void
  hide: () => void
  setHeight: (height: number) => void
}

export const useTerminalPanelStore = create<TerminalPanelState>()(
  persist(
    (set) => ({
      available: false,
      open: false,
      height: DEFAULT_TERMINAL_HEIGHT,
      setAvailable: (available) => set({ available }),
      toggle: () => set((state) => ({ open: !state.open })),
      hide: () => set({ open: false }),
      setHeight: (height) => {
        if (Number.isFinite(height) && height > 0) set({ height })
      },
    }),
    {
      name: 'purechat:layout:terminal',
      partialize: ({ height }) => ({ height }),
    }
  )
)
