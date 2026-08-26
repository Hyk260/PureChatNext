import { describe, expect, it } from 'vitest'

import {
  DEFAULT_THEME_MODE,
  parseStoredThemeMode,
  resolveThemeAppearance,
  serializeThemeMode,
} from './themeMode'

describe('theme mode persistence', () => {
  it('maps system and invalid storage values to auto', () => {
    expect(parseStoredThemeMode(null)).toBe(DEFAULT_THEME_MODE)
    expect(parseStoredThemeMode('system')).toBe('auto')
    expect(parseStoredThemeMode('unexpected')).toBe('auto')
  })

  it('preserves explicit light and dark storage values', () => {
    expect(parseStoredThemeMode('light')).toBe('light')
    expect(parseStoredThemeMode('dark')).toBe('dark')
  })

  it('serializes auto as the legacy system value', () => {
    expect(serializeThemeMode('auto')).toBe('system')
    expect(serializeThemeMode('light')).toBe('light')
    expect(serializeThemeMode('dark')).toBe('dark')
  })

  it('resolves auto from the current system appearance', () => {
    expect(resolveThemeAppearance('auto', 'dark')).toBe('dark')
    expect(resolveThemeAppearance('auto', 'light')).toBe('light')
    expect(resolveThemeAppearance('light', 'dark')).toBe('light')
    expect(resolveThemeAppearance('dark', 'light')).toBe('dark')
  })
})
