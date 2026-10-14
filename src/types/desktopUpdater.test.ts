import { describe, expect, it } from 'vitest'

import {
  DEFAULT_UPDATE_PREFERENCES,
  GITHUB_UPDATE_SOURCE,
  getUpdateSourceFromUrl,
  isUpdatePreferences,
  LOCAL_UPDATE_URL,
  normalizeUpdatePreferences,
  normalizeUpdateUrl,
  resolveUpdateSource,
} from './desktopUpdater'

describe('desktop update source preferences', () => {
  it('keeps legacy preferences and the packaged default until a source is selected', () => {
    const legacy = { autoUpdate: false, testPlan: true, testChannel: 'beta' as const }
    expect(isUpdatePreferences(legacy)).toBe(true)
    expect(normalizeUpdatePreferences(legacy)).toEqual(legacy)
    const fallback = getUpdateSourceFromUrl('https://cdn.example.com/desktop/')
    expect(resolveUpdateSource(legacy, fallback)).toEqual(fallback)
    expect(resolveUpdateSource(legacy, null)).toBeNull()
  })

  it('normalizes custom URLs without losing their directory or saved inactive address', () => {
    const preferences = {
      ...DEFAULT_UPDATE_PREFERENCES,
      updateSource: 'github',
      customUpdateUrl: ' https://cdn.example.com/desktop/ ',
    }
    expect(normalizeUpdatePreferences(preferences)).toMatchObject({ customUpdateUrl: 'https://cdn.example.com/desktop/' })
    expect(resolveUpdateSource(normalizeUpdatePreferences(preferences), null)).toEqual(GITHUB_UPDATE_SOURCE)
    expect(normalizeUpdateUrl('http://localhost:5501/releases')).toBe('http://localhost:5501/releases')
  })

  it.each(['', ' ', 'garbage', 'file:///tmp/releases', 'ftp://example.com/',
    'https://user:password@example.com/', 'https://example.com/#latest', 'https://example.com/#']) (
    'rejects an invalid update directory: %s', (customUpdateUrl) => {
      expect(() => normalizeUpdateUrl(customUpdateUrl)).toThrow()
      expect(isUpdatePreferences({ ...DEFAULT_UPDATE_PREFERENCES, updateSource: 'custom', customUpdateUrl })).toBe(false)
    }
  )

  it('drops corrupt source fields while preserving valid legacy switches', () => {
    const stored = { autoUpdate: false, testPlan: true, testChannel: 'beta', updateSource: 'custom', customUpdateUrl: 'file:///tmp' }
    expect(normalizeUpdatePreferences(stored)).toEqual({ autoUpdate: false, testPlan: true, testChannel: 'beta' })
    expect(isUpdatePreferences({ ...DEFAULT_UPDATE_PREFERENCES, updateSource: 'unknown' })).toBe(false)
    expect(isUpdatePreferences({ ...DEFAULT_UPDATE_PREFERENCES, updateSource: 'custom' })).toBe(false)
  })

  it('resolves the three sources and recognizes only the fixed loopback URL as the local preset', () => {
    expect(resolveUpdateSource({ ...DEFAULT_UPDATE_PREFERENCES, updateSource: 'local' }, null))
      .toEqual({ type: 'local', url: LOCAL_UPDATE_URL })
    expect(getUpdateSourceFromUrl(`${LOCAL_UPDATE_URL}/`)).toEqual({ type: 'local', url: LOCAL_UPDATE_URL })
    expect(getUpdateSourceFromUrl('http://127.0.0.1:5501')).toEqual({ type: 'custom', url: 'http://127.0.0.1:5501/' })
    expect(resolveUpdateSource({
      ...DEFAULT_UPDATE_PREFERENCES, updateSource: 'custom', customUpdateUrl: 'https://cdn.example.com/desktop/',
    }, GITHUB_UPDATE_SOURCE)).toEqual({ type: 'custom', url: 'https://cdn.example.com/desktop/' })
  })
})
