import { afterEach, describe, expect, it, vi } from 'vitest'

import { createStorage, localStg, sessionStg } from './storage'

const clearBrowserStorage = () => {
  window.localStorage.clear()
  window.sessionStorage.clear()
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearBrowserStorage()
})

describe('storage wrapper', () => {
  it('isolates local and session storage', () => {
    localStg.setString('key', 'local')
    sessionStg.setString('key', 'session')

    expect(localStg.getString('key')).toBe('local')
    expect(sessionStg.getString('key')).toBe('session')
  })

  it('applies a prefix exactly once to each storage key', () => {
    const prefixed = createStorage('local', 'app:')

    expect(prefixed.setString('key', 'value')).toBe(true)
    expect(window.localStorage.getItem('app:key')).toBe('value')
    expect(window.localStorage.getItem('app:app:key')).toBeNull()
    expect(prefixed.getString('key')).toBe('value')
  })

  it('preserves empty strings and falsy JSON values', () => {
    localStg.setString('empty', '')
    expect(localStg.getString('empty')).toBe('')

    for (const [key, value] of [
      ['false', false],
      ['zero', 0],
      ['empty-string', ''],
      ['null', null],
    ] as const) {
      expect(localStg.setJson(key, value)).toBe(true)
      expect(localStg.getJson(key)).toBe(value)
    }
  })

  it('returns null for malformed JSON without deleting it', () => {
    window.localStorage.setItem('broken', '{not-json')

    expect(localStg.getJson('broken')).toBeNull()
    expect(window.localStorage.getItem('broken')).toBe('{not-json')
  })

  it('contains cyclic JSON failures', () => {
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic

    expect(localStg.setJson('cyclic', cyclic)).toBe(false)
    expect(window.localStorage.getItem('cyclic')).toBeNull()
  })

  it('contains SSR and unavailable-window failures', () => {
    vi.stubGlobal('window', undefined)

    expect(localStg.getString('key')).toBeNull()
    expect(localStg.getJson('key')).toBeNull()
    expect(localStg.setString('key', 'value')).toBe(false)
    expect(localStg.setJson('key', { value: true })).toBe(false)
    expect(localStg.remove('key')).toBe(false)
  })

  it('contains storage property access failures', () => {
    const unavailableWindow = {}
    Object.defineProperty(unavailableWindow, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('storage unavailable')
      },
    })
    vi.stubGlobal('window', unavailableWindow)

    expect(localStg.getString('key')).toBeNull()
    expect(localStg.setString('key', 'value')).toBe(false)
    expect(localStg.remove('key')).toBe(false)
  })

  it('contains throwing Storage methods and quota failures', () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error('get failed')
      }),
      removeItem: vi.fn(() => {
        throw new Error('remove failed')
      }),
      setItem: vi.fn(() => {
        throw new Error('quota exceeded')
      }),
    } as unknown as Storage
    vi.stubGlobal('window', { localStorage: throwingStorage, sessionStorage: throwingStorage })

    expect(localStg.getString('key')).toBeNull()
    expect(localStg.getJson('key')).toBeNull()
    expect(localStg.setString('key', 'value')).toBe(false)
    expect(localStg.setJson('key', { value: true })).toBe(false)
    expect(localStg.remove('key')).toBe(false)
  })
})
