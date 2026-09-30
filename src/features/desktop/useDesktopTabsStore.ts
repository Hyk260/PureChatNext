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

const SETTINGS_SEGMENT_LABELS: Record<string, string> = {
  about: '关于',
  advanced: '高级设置',
  appearance: '外观',
  connector: '连接器',
  credits: '免费积分',
  creds: '凭证管理',
  'email-service': '邮件服务',
  hotkey: '快捷键',
  language: '语言',
  memory: '记忆设置',
  messenger: '聊天平台',
  notification: '通知',
  profile: '个人资料',
  provider: 'AI 服务商',
  'qq-conversation': 'QQ 对话',
  'read-file': '文件读取',
  s3: 'S3 测试',
  'service-model': '服务模型',
  skill: '技能',
  stats: '数据统计',
  storage: '数据存储',
  'system-tools': '系统工具',
  usage: '用量',
  users: '用户管理',
  'web-search': '联网搜索',
  'wechat-conversation': '微信对话',
}

const ADMIN_SEGMENT_LABELS: Record<string, string> = {
  'email-service': '邮件服务',
  'qq-conversation': 'QQ 对话',
  'read-file': '文件读取',
  s3: 'S3 测试',
  users: '用户管理',
  'web-search': '联网搜索',
  'wechat-conversation': '微信对话',
}

function segmentLabel(pathname: string, index: number, fallback: string, labels?: Record<string, string>) {
  const segment = pathname.split('/').filter(Boolean)[index]
  if (!segment) return fallback
  if (labels?.[segment]) return labels[segment]
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function titleFromLocation(pathname: string, _search = ''): string {
  if (pathname === '/' || pathname === '') return 'PureChat'
  if (pathname.startsWith('/chat')) return '聊天'
  if (pathname.startsWith('/settings')) return segmentLabel(pathname, 1, '设置', SETTINGS_SEGMENT_LABELS)
  if (pathname.startsWith('/admin')) return segmentLabel(pathname, 1, '管理', ADMIN_SEGMENT_LABELS)
  if (pathname.startsWith('/community')) return segmentLabel(pathname, 1, '社区')
  if (pathname.startsWith('/resources')) return segmentLabel(pathname, 1, '资源')
  if (pathname.startsWith('/signin')) return '登录'
  if (pathname.startsWith('/signup')) return '注册'
  if (pathname.startsWith('/verify-email')) return '验证邮箱'
  if (pathname.startsWith('/reset-password')) return '重置密码'
  if (pathname.startsWith('/dev/')) return segmentLabel(pathname, 1, '开发')
  return pathname.split('/').filter(Boolean).at(-1) ?? 'PureChat'
}

/** Keep newest entry per href and per display title. */
export function dedupeHistoryEntries(entries: DesktopHistoryEntry[]): DesktopHistoryEntry[] {
  const seenHref = new Set<string>()
  const seenTitle = new Set<string>()
  const result: DesktopHistoryEntry[] = []
  for (const entry of entries) {
    const href = desktopHref(entry)
    if (seenHref.has(href) || seenTitle.has(entry.title)) continue
    seenHref.add(href)
    seenTitle.add(entry.title)
    result.push(entry)
  }
  return result
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
      const nextEntry = { id: nextId(), path, search, title, visitedAt: Date.now() }
      const historyEntries = dedupeHistoryEntries(
        sameAsLast
          ? [{ ...last, title, visitedAt: Date.now() }, ...state.historyEntries.slice(1)]
          : [nextEntry, ...state.historyEntries]
      ).slice(0, MAX_HISTORY)

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
