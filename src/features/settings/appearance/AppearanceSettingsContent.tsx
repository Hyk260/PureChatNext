'use client'

import { Flex, Input, Text } from '@pure/ui'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useThemeMode } from 'antd-style'
import type { ThemeMode } from 'antd-style'

import { useThemeColor } from '@/layout/themeColor'

const themeModeOptions: { icon: typeof Sun; label: string; value: ThemeMode }[] = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '系统', value: 'auto' },
]

const themeColorPresets = ['#00B96B', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6']
const fullHexColorPattern = /^#[\da-f]{6}$/i
const shortHexColorPattern = /^#[\da-f]{3}$/i

const normalizeHexColor = (value: string): string | null => {
  const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`

  if (fullHexColorPattern.test(normalized)) return normalized.toUpperCase()
  if (!shortHexColorPattern.test(normalized)) return null

  const expanded = normalized
    .slice(1)
    .split('')
    .map((character) => `${character}${character}`)
    .join('')

  return `#${expanded.toUpperCase()}`
}

const ThemePreview = ({ mode }: { mode: ThemeMode }) => {
  if (mode === 'auto') {
    return (
      <div className='flex aspect-[16/9] overflow-hidden rounded-lg border border-neutral-300'>
        <ThemePreviewPanel mode='light' className='w-1/2 border-r border-neutral-300' />
        <ThemePreviewPanel mode='dark' className='w-1/2' />
      </div>
    )
  }

  const isDark = mode === 'dark'
  const previewClass = isDark ? 'border-neutral-700 bg-neutral-950' : 'border-neutral-300 bg-white'

  return (
    <div className={`flex aspect-[16/9] overflow-hidden rounded-lg border ${previewClass}`}>
      <ThemePreviewPanel mode={mode} className='w-full' />
    </div>
  )
}

const ThemePreviewPanel = ({ mode, className }: { mode: 'light' | 'dark'; className: string }) => {
  const isDark = mode === 'dark'
  const sidebarClass = isDark ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-neutral-100'
  const dotClass = isDark ? 'bg-neutral-500' : 'bg-neutral-400'
  const titleClass = isDark ? 'bg-neutral-600' : 'bg-neutral-300'
  const lineClass = isDark ? 'bg-neutral-800' : 'bg-neutral-200'

  return (
    <div className={`flex ${className} ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
      <div className={`w-1/4 border-r p-2 ${sidebarClass}`}>
        <div className={`size-2 rounded-full ${dotClass}`} />
        <div className={`mt-2 h-1.5 w-full rounded-full ${titleClass}`} />
        <div className={`mt-1.5 h-1.5 w-2/3 rounded-full ${titleClass}`} />
      </div>
      <div className='min-w-0 flex-1 p-3'>
        <div className={`h-1.5 w-1/2 rounded-full ${titleClass}`} />
        <div className={`mt-2.5 h-1.5 w-full rounded-full ${lineClass}`} />
        <div className={`mt-1.5 h-1.5 w-3/4 rounded-full ${lineClass}`} />
      </div>
    </div>
  )
}

const ThemeColorPicker = () => {
  const { themeColor, setThemeColor } = useThemeColor()
  const [draftColor, setDraftColor] = useState(themeColor)

  const handleThemeColorChange = (nextColor: string) => {
    setDraftColor(nextColor)
    setThemeColor(nextColor)
  }

  const handleHexBlur = () => {
    const normalizedColor = normalizeHexColor(draftColor)

    if (!normalizedColor) {
      setDraftColor(themeColor)
      return
    }

    handleThemeColorChange(normalizedColor)
  }

  return (
    <Flex className='flex-wrap items-center justify-end gap-3'>
      <Flex className='flex-wrap items-center gap-3' role='group' aria-label='主题颜色预设'>
        {themeColorPresets.map((color) => {
          const isSelected = themeColor.toUpperCase() === color
          const selectedClass = isSelected ? 'border-primary' : 'border-transparent'

          return (
            <button
              key={color}
              type='button'
              aria-label={color}
              aria-pressed={isSelected}
              className={`size-8 rounded-full border-2 p-0.5 outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary ${selectedClass}`}
              onClick={() => handleThemeColorChange(color)}
            >
              <span className='block size-full rounded-full' style={{ backgroundColor: color }} />
            </button>
          )
        })}
      </Flex>
      <label className='relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-app-border-secondary bg-app-surface shadow-sm outline-none focus-within:ring-2 focus-within:ring-primary'>
        <input
          type='color'
          value={themeColor}
          aria-label='自定义主题颜色'
          className='absolute inset-0 size-full cursor-pointer opacity-0'
          onChange={(event) => handleThemeColorChange(event.currentTarget.value.toUpperCase())}
        />
        <span
          className='size-7 rounded-md border border-app-border-secondary'
          style={{ backgroundColor: themeColor }}
        />
      </label>
      <Input
        aria-label='主题颜色十六进制值'
        value={draftColor}
        className='w-32 text-center font-mono uppercase'
        spellCheck={false}
        onChange={(event) => setDraftColor(event.currentTarget.value)}
        onBlur={handleHexBlur}
      />
    </Flex>
  )
}

const AppearanceSettingsContent = () => {
  const { setThemeMode, themeMode } = useThemeMode()

  return (
    <Flex className='w-full flex-col gap-6 px-6 pb-16 pt-6'>
      <section
        aria-labelledby='appearance-theme-heading'
        className='mx-auto w-full max-w-[1200px] rounded-2xl border border-app-border-secondary bg-app-surface p-6'
      >
        <Text as='h2' id='appearance-theme-heading' strong>
          主题
        </Text>
        <div className='my-4 border-t border-app-border-secondary' />
        <Flex className='grid w-full grid-cols-1 gap-3 sm:grid-cols-3' role='group' aria-label='主题模式'>
          {themeModeOptions.map((option) => {
            const Icon = option.icon
            const isSelected = themeMode === option.value
            const cardStateClass = isSelected
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-app-border-secondary hover:border-primary/50'

            return (
              <button
                key={option.value}
                type='button'
                aria-label={option.label}
                aria-pressed={isSelected}
                className='group min-w-0 rounded-xl pb-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary'
                onClick={() => setThemeMode(option.value)}
              >
                <div className={`rounded-xl border bg-background p-2 transition-colors ${cardStateClass}`}>
                  <ThemePreview mode={option.value} />
                </div>
                <span className='mt-3 flex items-center justify-center gap-2 text-sm'>
                  <Icon aria-hidden='true' className='size-4' />
                  {option.label}
                </span>
              </button>
            )
          })}
        </Flex>
        <div className='my-4 border-t border-app-border-secondary' />
        <Flex className='flex-between-wrap gap-4'>
          <Text>主题颜色</Text>
          <ThemeColorPicker />
        </Flex>
      </section>
    </Flex>
  )
}

AppearanceSettingsContent.displayName = 'AppearanceSettingsContent'

export default AppearanceSettingsContent
