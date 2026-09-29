import { beforeEach, describe, expect, it } from 'vitest'

import { desktopHref, titleFromLocation, useDesktopTabsStore } from './useDesktopTabsStore'

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

  it('derives titles from path', () => {
    expect(titleFromLocation('/', '')).toBe('PureChat')
    expect(titleFromLocation('/chat', '')).toBe('聊天')
    expect(titleFromLocation('/settings/about', '')).toBe('设置')
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
    useDesktopTabsStore.getState().syncLocation('/settings', '', 'PUSH')
    useDesktopTabsStore.getState().syncLocation('/chat', '', 'PUSH')

    const entries = useDesktopTabsStore.getState().historyEntries
    const hrefs = entries.map((entry) => desktopHref(entry))
    expect(hrefs).toEqual(['/chat', '/settings'])
  })
})
