import { afterEach, describe, expect, it } from 'vitest'

import { filterBrowserHistory, rememberBrowserVisit, useBrowserHistoryStore } from './history'

afterEach(() => {
  useBrowserHistoryStore.setState({ byScope: {} })
  localStorage.clear()
})

describe('browser address history', () => {
  it('keeps five recent distinct URLs and replaces the oldest with a new visit', () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      url: `https://example.com/${index}`,
      title: `Page ${index}`,
    })).reduce(rememberBrowserVisit, [])
    expect(history.map((item) => item.title)).toEqual(['Page 5', 'Page 4', 'Page 3', 'Page 2', 'Page 1'])
    const repeated = rememberBrowserVisit(history, { url: 'https://example.com/2', title: 'New title' })
    expect(repeated).toHaveLength(5)
    expect(repeated[0].title).toBe('New title')
    expect(repeated.map((item) => item.url)).toEqual([
      'https://example.com/2',
      'https://example.com/5',
      'https://example.com/4',
      'https://example.com/3',
      'https://example.com/1',
    ])
  })

  it('matches title or URL without case sensitivity and ignores blank or unsafe pages', () => {
    const history = rememberBrowserVisit([], { url: 'https://example.com/docs', title: '使用文档' })
    expect(filterBrowserHistory(history, '使用')).toHaveLength(1)
    expect(filterBrowserHistory(history, 'EXAMPLE.COM/DOCS')).toHaveLength(1)
    expect(filterBrowserHistory(history, 'missing')).toEqual([])
    for (const url of ['about:blank', 'javascript:alert(1)', 'https://user:password@example.com']) {
      expect(rememberBrowserVisit(history, { url, title: 'Invalid' })).toBe(history)
    }
    expect(rememberBrowserVisit(history, { url: 'https://example.com/docs', title: '' })[0].title).toBe('使用文档')
  })

  it('persists history locally and isolates each user/server scope', async () => {
    const store = useBrowserHistoryStore.getState()
    store.remember('server-a:user-a', { url: 'https://example.com/a', title: 'A' })
    store.remember('server-a:user-b', { url: 'https://example.com/b', title: 'B' })
    store.remember('server-b:user-a', { url: 'https://example.com/c', title: 'C' })
    const saved = localStorage.getItem('purechat:browser:v1:history')!
    useBrowserHistoryStore.setState({ byScope: {} })
    localStorage.setItem('purechat:browser:v1:history', saved)
    await useBrowserHistoryStore.persist.rehydrate()
    expect(useBrowserHistoryStore.getState().byScope['server-a:user-a']).toEqual([
      { url: 'https://example.com/a', title: 'A' },
    ])
    expect(useBrowserHistoryStore.getState().byScope['server-a:user-b'][0].title).toBe('B')
    expect(useBrowserHistoryStore.getState().byScope['server-b:user-a'][0].title).toBe('C')
  })
})
