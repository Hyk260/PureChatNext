import { createContext, useContext } from 'react'

export const THEME_COLOR_STORAGE_KEY = 'theme-color'
export const DEFAULT_THEME_COLOR = 'default'

export type ThemeColor = typeof DEFAULT_THEME_COLOR | `#${string}`

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i

export const parseStoredThemeColor = (value: string | null): ThemeColor => {
  if (!value || !HEX_COLOR_PATTERN.test(value)) return DEFAULT_THEME_COLOR
  return `#${value.slice(1).toUpperCase()}`
}

export const getThemeColorForeground = (color: string): string => {
  const channels = color.slice(1).match(/[\da-f]{2}/gi)
  if (!channels || channels.length !== 3) return '#FFFFFF'

  const [red = 0, green = 0, blue = 0] = channels.map((channel) => Number.parseInt(channel, 16) / 255)
  const linearize = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const luminance = linearize(red) * 0.2126 + linearize(green) * 0.7152 + linearize(blue) * 0.0722

  return luminance > 0.179 ? '#000000' : '#FFFFFF'
}

interface ThemeColorContextValue {
  themeColor: ThemeColor
  resolvedThemeColor: string
  setThemeColor: (color: string) => void
}

export const ThemeColorContext = createContext<ThemeColorContextValue | undefined>(undefined)

export const useThemeColor = (): ThemeColorContextValue => {
  const context = useContext(ThemeColorContext)

  if (!context) {
    throw new Error('useThemeColor must be used within ThemeProviders')
  }

  return context
}
