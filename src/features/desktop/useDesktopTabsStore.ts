import { createNanoId } from '@pure/utils'
import { create } from 'zustand'

export type DesktopTab = {
  id: string
  path: string
  search: string
  title: string
}

export type DesktopHistoryEntry = {
  id: string
  path: string
  search: string
  title: string
  visitedAt: number
}

const MAX_HISTORY = 20
const nextId = createNanoId(10)

export function desktopHref(tab: Pick<DesktopTab, 'path' | 'search'>): string {
  return `${tab.path}${tab.search}`
}

export function titleFromLocation(pathname: string, search: string): string {
  if (pathname === '/' || pathname === '') return 'PureChat'
  if (pathname.startsWith('/chat')) return '聊天'
  if (pathname.startsWith('/settings')) return '设置'
  if (pathname.startsWith('/community')) return '社区'
  if (pathname.startsWith('/resources')) return '资源'
  if (pathname.startsWith('/admin')) return '管理'
  if (pathname.startsWith('/signin')) return '登录'
  return pathname.split('/').filter(Boolean).at(-1) ?? 'PureChat'
}

function createTab(path = '/', search = '', title?: string): DesktopTab {
  return {
    id: nextId(),
    path,
    search,
    title: title ?? titleFromLocation(path, search),
  }
}

type NavigationType = 'POP' | 'PUSH' | 'REPLACE'

interface DesktopTabsState {
  activeTabId: string
  canGoBack: boolean
  canGoForward: boolean
  historyEntries: DesktopHistoryEntry[]
  historyIndex: number
  historyStack: string[]
  tabs: DesktopTab[]
  activateTab: (id: string) => DesktopTab | null
  addTab: (path?: string, search?: string) => DesktopTab
  closeTab: (id: string) => { closedActive: boolean; next: DesktopTab | null }
  markBack: () => void
  markForward: () => void
  syncLocation: (path: string, search: string, navigationType: NavigationType) => void
}

const initialTab = createTab('/', '', 'PureChat')
const initialHref = desktopHref(initialTab)

export const useDesktopTabsStore = create<DesktopTabsState>((set, get) => ({
  activeTabId: initialTab.id,
  canGoBack: false,
  canGoForward: false,
  historyEntries: [],
  historyIndex: 0,
  historyStack: [initialHref],
  tabs: [initialTab],

  activateTab: (id) => {
    const tab = get().tabs.find((item) => item.id === id)
    if (!tab) return null
    set({ activeTabId: id })
    return tab
  },

  addTab: (path = '/', search = '') => {
    const tab = createTab(path, search)
    set((state) => ({
      activeTabId: tab.id,
      tabs: [...state.tabs, tab],
    }))
    return tab
  },

  closeTab: (id) => {
    const { activeTabId, tabs } = get()
    if (tabs.length <= 1) {
      const home = createTab('/', '', 'PureChat')
      set({ activeTabId: home.id, tabs: [home] })
      return { closedActive: true, next: home }
    }
    const index = tabs.findIndex((tab) => tab.id === id)
    if (index < 0) return { closedActive: false, next: null }
    const nextTabs = tabs.filter((tab) => tab.id !== id)
    const closedActive = activeTabId === id
    const next = closedActive ? (nextTabs[Math.max(0, index - 1)] ?? nextTabs[0] ?? null) : null
    set({
      activeTabId: closedActive && next ? next.id : activeTabId,
      tabs: nextTabs,
    })
    return { closedActive, next }
  },

  markBack: () => {
    const { historyIndex } = get()
    if (historyIndex <= 0) return
    const nextIndex = historyIndex - 1
    set({
      canGoBack: nextIndex > 0,
      canGoForward: true,
      historyIndex: nextIndex,
    })
  },

  markForward: () => {
    const { historyIndex, historyStack } = get()
    if (historyIndex >= historyStack.length - 1) return
    const nextIndex = historyIndex + 1
    set({
      canGoBack: nextIndex > 0,
      canGoForward: nextIndex < historyStack.length - 1,
      historyIndex: nextIndex,
    })
  },

  syncLocation: (path, search, navigationType) => {
    const title = titleFromLocation(path, search)
    const href = `${path}${search}`
    set((state) => {
      const tabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, path, search, title } : tab
      )
      const last = state.historyEntries[0]
      const sameAsLast = last && `${last.path}${last.search}` === href
      const historyEntries = sameAsLast
        ? [{ ...last, title, visitedAt: Date.now() }, ...state.historyEntries.slice(1)]
        : [
            { id: nextId(), path, search, title, visitedAt: Date.now() },
            ...state.historyEntries.filter((entry) => `${entry.path}${entry.search}` !== href),
          ].slice(0, MAX_HISTORY)

      let historyStack = state.historyStack
      let historyIndex = state.historyIndex

      if (navigationType === 'PUSH') {
        historyStack = [...state.historyStack.slice(0, state.historyIndex + 1), href]
        historyIndex = historyStack.length - 1
      } else if (navigationType === 'REPLACE') {
        historyStack = [...state.historyStack.slice(0, state.historyIndex), href]
        historyIndex = historyStack.length - 1
      } else {
        const existing = state.historyStack.lastIndexOf(href)
        if (existing >= 0) historyIndex = existing
      }

      return {
        canGoBack: historyIndex > 0,
        canGoForward: historyIndex < historyStack.length - 1,
        historyEntries,
        historyIndex,
        historyStack,
        tabs,
      }
    })
  },
}))
