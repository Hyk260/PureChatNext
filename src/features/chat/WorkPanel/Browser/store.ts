import { create } from 'zustand'

import type { BrowserState } from '@/types/desktopBrowser'
import { getDesktopApi } from '@/types/desktop'
import { useChatDraftStore } from '@/features/chat/store/useChatDraftStore'

interface BrowserPanelEntry {
  instanceId: number
  active: boolean
  state?: BrowserState
}

interface BrowserPanelStore {
  currentKey: string | null
  entries: Record<string, BrowserPanelEntry>
  open: (key: string) => void
  setActive: (key: string, active: boolean) => void
  update: (key: string, state: BrowserState, instanceId: number) => void
  close: (key: string) => Promise<void>
  reset: () => void
}

let nextInstanceId = 0

export const useBrowserPanelStore = create<BrowserPanelStore>((set, get) => ({
  currentKey: null,
  entries: {},
  open: (key) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [key]: { ...state.entries[key], instanceId: state.entries[key]?.instanceId ?? ++nextInstanceId, active: true },
      },
    })),
  setActive: (key, active) =>
    set((state) => {
      const entry = state.entries[key]
      return entry ? { entries: { ...state.entries, [key]: { ...entry, active } } } : state
    }),
  update: (key, value, instanceId) =>
    set((state) => {
      const entry = state.entries[key]
      return entry?.instanceId === instanceId
        ? { entries: { ...state.entries, [key]: { ...entry, state: value } } }
        : state
    }),
  close: async (key) => {
    const entry = get().entries[key]
    set((state) => {
      const entries = { ...state.entries }
      delete entries[key]
      return { entries }
    })
    if (entry?.state) await getDesktopApi()?.browser.close({ sessionId: entry.state.sessionId })
  },
  reset: () => set({ entries: {}, currentKey: null }),
}))

export function resetBrowserWorkspace() {
  useBrowserPanelStore.getState().reset()
  useChatDraftStore.setState({ files: {}, browserSelections: {} })
  getDesktopApi()
    ?.browser?.reset()
    .catch(() => undefined)
}
