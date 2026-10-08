import { beforeEach, describe, expect, it } from 'vitest'

import {
  dedupeHistoryEntries,
  desktopHref,
  titleFromLocation,
  useDesktopTabsStore,
} from './useDesktopTabsStore'

describe('useDesktopTabsStore', () => {
  beforeEach(() => {
    const tab = useDesktopTabsStore.getState().tabs[0]
    useDesktopTabsStore.setState({
      activeTabId: tab?.id ?? 'tab',
      canGoBack: false,
      canGoForward: false,
      historyEntries: [],
      historyIndex: 0,
      historyStack: [desktopHref({ path: '/', search: '' })],
      tabs: tab ? [{ ...tab, path: '/', search: '', title: 'PureChat' }] : [],
    })
  })

  it('derives specific titles from path', () => {
    expect(titleFromLocation('/', '')).toBe('PureChat')
    expect(titleFromLocation('/chat', '')).toBe('聊天')
    expect(titleFromLocation('/settings/about', '')).toBe('关于')
    expect(titleFromLocation('/settings/profile', '')).toBe('个人资料')
    expect(titleFromLocation('/admin/users', '')).toBe('用户管理')
    expect(titleFromLocation('/verify-email', '')).toBe('验证邮箱')
  })

  it('adds and closes tabs', () => {
    const added = useDesktopTabsStore.getState().addTab('/chat')
    expect(useDesktopTabsStore.getState().tabs).toHaveLength(2)
    expect(useDesktopTabsStore.getState().activeTabId).toBe(added.id)

    const { closedActive, next } = useDesktopTabsStore.getState().closeTab(added.id)
    expect(closedActive).toBe(true)
    expect(next?.path).toBe('/')
    expect(useDesktopTabsStore.getState().tabs).toHaveLength(1)
  })

  it('keeps the last tab when close is requested', () => {
    const [lastTab] = useDesktopTabsStore.getState().tabs
    if (!lastTab) throw new Error('Expected the initial tab')

    const result = useDesktopTabsStore.getState().closeTab(lastTab.id)

    expect(result).toEqual({ closedActive: false, next: null })
    expect(useDesktopTabsStore.getState().tabs).toEqual([lastTab])
    expect(useDesktopTabsStore.getState().activeTabId).toBe(lastTab.id)
  })

  it('tracks history stack on push and back', () => {
    useDesktopTabsStore.getState().syncLocation('/chat', '', 'PUSH')
    expect(useDesktopTabsStore.getState().canGoBack).toBe(true)
    expect(useDesktopTabsStore.getState().canGoForward).toBe(false)

    useDesktopTabsStore.getState().markBack()
    expect(useDesktopTabsStore.getState().canGoBack).toBe(false)
    expect(useDesktopTabsStore.getState().canGoForward).toBe(true)
  })

  it('dedupes history entries by href', () => {
    useDesktopTabsStore.getState().syncLocation('/chat', '', 'PUSH')
    useDesktopTabsStore.getState().syncLocation('/settings/about', '', 'PUSH')
    useDesktopTabsStore.getState().syncLocation('/chat', '', 'PUSH')

    const entries = useDesktopTabsStore.getState().historyEntries
    const hrefs = entries.map((entry) => desktopHref(entry))
    expect(hrefs).toEqual(['/chat', '/settings/about'])
  })

  it('dedupes history entries by title', () => {
    useDesktopTabsStore.getState().syncLocation('/settings/profile', '', 'PUSH')
    useDesktopTabsStore.getState().syncLocation('/community/a', '', 'PUSH')
    useDesktopTabsStore.getState().syncLocation('/community/b', '', 'PUSH')

    // community/a and community/b would both become distinct segments; force same title
    const entries = dedupeHistoryEntries([
      { id: '1', path: '/settings/a', search: '', title: '设置', visitedAt: 3 },
      { id: '2', path: '/settings/b', search: '', title: '设置', visitedAt: 2 },
      { id: '3', path: '/chat', search: '', title: '聊天', visitedAt: 1 },
    ])
    expect(entries.map((entry) => entry.id)).toEqual(['1', '3'])
  })
})
