import { createContext, useContext } from 'react'

export type ThemeMode = 'auto' | 'light' | 'dark'

interface ThemeModeContextValue {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined)

export const useAppThemeMode = (): ThemeModeContextValue => {
  const context = useContext(ThemeModeContext)
  if (!context) throw new Error('useAppThemeMode must be used within ThemeProviders')
  return context
}

export const THEME_STORAGE_KEY = 'theme'
export const DEFAULT_THEME_MODE: ThemeMode = 'auto'

export const parseStoredThemeMode = (value: string | null): ThemeMode => {
  if (value === 'light' || value === 'dark') return value
  return DEFAULT_THEME_MODE
}

export const serializeThemeMode = (themeMode: ThemeMode): string => (themeMode === 'auto' ? 'system' : themeMode)

export const resolveThemeAppearance = (themeMode: ThemeMode, systemAppearance: 'light' | 'dark'): 'light' | 'dark' =>
  themeMode === 'auto' ? systemAppearance : themeMode
