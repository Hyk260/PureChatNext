import type { ThemeMode } from 'antd-style'

export const THEME_STORAGE_KEY = 'theme'
export const DEFAULT_THEME_MODE: ThemeMode = 'auto'

export const parseStoredThemeMode = (value: string | null): ThemeMode => {
  if (value === 'light' || value === 'dark') return value
  return DEFAULT_THEME_MODE
}

export const serializeThemeMode = (themeMode: ThemeMode): string =>
  themeMode === 'auto' ? 'system' : themeMode

export const resolveThemeAppearance = (
  themeMode: ThemeMode,
  systemAppearance: 'light' | 'dark',
): 'light' | 'dark' => (themeMode === 'auto' ? systemAppearance : themeMode)
