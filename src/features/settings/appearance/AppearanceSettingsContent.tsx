'use client'

import { Select, Text } from '@pure/ui'
import { useThemeMode } from 'antd-style'
import type { ThemeMode } from 'antd-style'

const themeModeOptions: { label: string; value: ThemeMode }[] = [
  { label: '自动（跟随系统）', value: 'auto' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

const AppearanceSettingsContent = () => {
  const { setThemeMode, themeMode } = useThemeMode()

  return (
    <div className='flex w-full flex-col gap-6 px-6 pb-16 pt-6'>
      <div className='flex-between-wrap w-full max-w-[720px] gap-6'>
        <div className='min-w-0 flex-1'>
          <Text strong>主题模式</Text>
          <Text type='secondary'>自动模式会跟随系统的浅色或深色外观。</Text>
        </div>
        <Select
          aria-label='主题模式'
          className='w-48 shrink-0'
          options={themeModeOptions}
          value={themeMode}
          onChange={(value) => setThemeMode(value as ThemeMode)}
        />
      </div>
    </div>
  )
}

AppearanceSettingsContent.displayName = 'AppearanceSettingsContent'

export default AppearanceSettingsContent
