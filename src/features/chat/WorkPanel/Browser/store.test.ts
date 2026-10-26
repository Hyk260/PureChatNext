import { afterEach, describe, expect, it } from 'vitest'

import { useBrowserPanelStore } from './store'

afterEach(() => useBrowserPanelStore.getState().reset())

describe('browser panel sessions', () => {
  it('keeps one tab per context and ignores late results after closing', async () => {
    const store = useBrowserPanelStore.getState()
    store.open('a')
    store.open('a')
    store.open('b')
    expect(Object.keys(useBrowserPanelStore.getState().entries)).toEqual(['a', 'b'])
    store.setActive('a', false)
    expect(useBrowserPanelStore.getState().entries.b.active).toBe(true)
    const instanceId = useBrowserPanelStore.getState().entries.a.instanceId
    await store.close('a')
    const lateState = {
      contextKey: 'a',
      sessionId: 'late',
      url: 'about:blank',
      title: '',
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }
    store.update('a', lateState, instanceId)
    expect(useBrowserPanelStore.getState().entries.a).toBeUndefined()
    expect(useBrowserPanelStore.getState().entries.b).toBeDefined()
    store.open('a')
    store.update('a', lateState, instanceId)
    expect(useBrowserPanelStore.getState().entries.a.state).toBeUndefined()
  })
})
