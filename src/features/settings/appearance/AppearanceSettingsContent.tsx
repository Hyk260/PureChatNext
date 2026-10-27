'use client'

import { Flex, Input, Text } from '@pure/ui'
import { ActionIcon, ColorSwatches, cssVar, primaryColors, toast } from '@lobehub/ui'
import { Minus, Monitor, Moon, Plus, RotateCcw, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAppThemeMode } from '@/layout/themeMode'
import type { ThemeMode } from '@/layout/themeMode'
import { getDesktopApi } from '@/types/desktop'

import { DEFAULT_THEME_COLOR, useThemeColor } from '@/layout/themeColor'

const themeModeOptions: { icon: typeof Sun; label: string; value: ThemeMode }[] = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '系统', value: 'auto' },
]

const defaultThemeColorSwatch = 'rgba(0, 0, 0, 0)'
const themeColorSwatches = [
  { color: defaultThemeColorSwatch, title: 'Default', themeColor: DEFAULT_THEME_COLOR },
  { color: cssVar.red, title: 'Red', themeColor: primaryColors.red },
  { color: cssVar.orange, title: 'Orange', themeColor: primaryColors.orange },
  { color: cssVar.gold, title: 'Gold', themeColor: primaryColors.gold },
  { color: cssVar.green, title: 'Green', themeColor: primaryColors.green },
  { color: cssVar.cyan, title: 'Cyan', themeColor: primaryColors.cyan },
  { color: cssVar.blue, title: 'Blue', themeColor: primaryColors.blue },
  { color: cssVar.geekblue, title: 'Geekblue', themeColor: primaryColors.geekblue },
  { color: cssVar.purple, title: 'Purple', themeColor: primaryColors.purple },
  { color: cssVar.magenta, title: 'Magenta', themeColor: primaryColors.magenta },
  { color: cssVar.volcano, title: 'Volcano', themeColor: primaryColors.volcano },
]
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
      <div className='flex aspect-16/9 overflow-hidden rounded-lg border border-neutral-300'>
        <ThemePreviewPanel mode='light' className='w-1/2 border-r border-neutral-300' />
        <ThemePreviewPanel mode='dark' className='w-1/2' />
      </div>
    )
  }

  const isDark = mode === 'dark'
  const previewClass = isDark ? 'border-neutral-700 bg-neutral-950' : 'border-neutral-300 bg-white'

  return (
    <div className={`flex aspect-16/9 overflow-hidden rounded-lg border ${previewClass}`}>
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
  const { themeColor, resolvedThemeColor, setThemeColor } = useThemeColor()
  const [draftColor, setDraftColor] = useState<string | null>(null)
  const activeThemeColorSwatch = themeColorSwatches.find(
    (swatch) => swatch.themeColor.toUpperCase() === themeColor.toUpperCase()
  )

  const handleThemeColorChange = (nextColor: string) => {
    setDraftColor(null)
    setThemeColor(nextColor)
  }

  const handleSwatchesChange = (color?: string) => {
    if (!color) return

    const selectedSwatch = themeColorSwatches.find((swatch) => swatch.color === color)
    handleThemeColorChange(selectedSwatch?.themeColor ?? color.toUpperCase())
  }

  const handleHexBlur = () => {
    if (draftColor === null) return
    const normalizedColor = normalizeHexColor(draftColor)

    if (!normalizedColor) {
      setDraftColor(null)
      return
    }

    handleThemeColorChange(normalizedColor)
  }

  return (
    <Flex className='flex-wrap items-center justify-end gap-3'>
      <ColorSwatches
        aria-label='主题颜色预设'
        className='flex-wrap'
        colors={themeColorSwatches}
        enableColorPicker
        enableColorSwatches
        onChange={handleSwatchesChange}
        role='group'
        shape='circle'
        size={32}
        texts={{ custom: '自定义' }}
        value={activeThemeColorSwatch?.color ?? themeColor}
      />
      <Input
        aria-label='主题颜色十六进制值'
        value={draftColor ?? resolvedThemeColor}
        className='w-32 text-center font-mono uppercase'
        spellCheck={false}
        onChange={(event) => setDraftColor(event.currentTarget.value)}
        onBlur={handleHexBlur}
      />
    </Flex>
  )
}

const AppearanceSettingsContent = () => {
  const { setThemeMode, themeMode } = useAppThemeMode()
  const desktopApi = getDesktopApi()
  const [zoomFactor, setZoomFactor] = useState(1)
  const [isZoomBusy, setIsZoomBusy] = useState(false)
  const isDefaultZoom = Math.abs(zoomFactor - 1) < 0.001

  useEffect(() => {
    if (!desktopApi) return

    let cancelled = false
    desktopApi.zoom
      .getFactor()
      .then((factor) => {
        if (!cancelled) setZoomFactor(factor)
      })
      .catch(() => {
        if (!cancelled) toast.error('读取缩放设置失败')
      })

    return () => {
      cancelled = true
    }
  }, [desktopApi])

  const handleZoomChange = async (delta: number, reset = false) => {
    if (!desktopApi || isZoomBusy) return

    setIsZoomBusy(true)
    try {
      setZoomFactor(await desktopApi.zoom.adjust({ delta, reset }))
    } catch {
      toast.error('调整缩放失败')
    } finally {
      setIsZoomBusy(false)
    }
  }

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
                <span className='mt-3 flex-center gap-2 text-sm'>
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
      {desktopApi ? (
        <section
          aria-labelledby='appearance-display-heading'
          className='mx-auto w-full max-w-[1200px] rounded-2xl border border-app-border-secondary bg-app-surface p-6'
        >
          <Text as='h2' id='appearance-display-heading' strong>
            显示与语言
          </Text>
          <div className='my-4 border-t border-app-border-secondary' />
          <Flex className='flex-between-wrap gap-4'>
            <Text>缩放</Text>
            <Flex className='items-center gap-1'>
              {!isDefaultZoom ? (
                <ActionIcon
                  aria-label='重置缩放'
                  disabled={isZoomBusy}
                  icon={RotateCcw}
                  size='small'
                  title='重置缩放'
                  onClick={() => handleZoomChange(0, true)}
                />
              ) : null}
              <ActionIcon
                aria-label='缩小'
                disabled={isZoomBusy || zoomFactor <= 0.5}
                icon={Minus}
                size='small'
                title='缩小'
                onClick={() => handleZoomChange(-0.1)}
              />
              <Text className='min-w-12 text-center tabular-nums'>{Math.round(zoomFactor * 100)}%</Text>
              <ActionIcon
                aria-label='放大'
                disabled={isZoomBusy || zoomFactor >= 2}
                icon={Plus}
                size='small'
                title='放大'
                onClick={() => handleZoomChange(0.1)}
              />
            </Flex>
          </Flex>
        </section>
      ) : null}
    </Flex>
  )
}

AppearanceSettingsContent.displayName = 'AppearanceSettingsContent'

export default AppearanceSettingsContent
