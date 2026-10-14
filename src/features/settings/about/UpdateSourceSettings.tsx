import { Button, Flex, Input, Select, Text } from '@pure/ui'
import type { FormEvent } from 'react'
import { useState } from 'react'

import type { DesktopUpdatePreferences, DesktopUpdateSource, DesktopUpdateSourceType } from '@/types/desktopUpdater'
import { isUpdateSourceType, normalizeUpdateUrl } from '@/types/desktopUpdater'

const SOURCE_OPTIONS = [
  { label: '本地', value: 'local' },
  { label: 'GitHub', value: 'github' },
  { label: '自定义', value: 'custom' },
]

interface UpdateSourceSettingsProps {
  preferences: DesktopUpdatePreferences
  source: DesktopUpdateSource | null
  disabled: boolean
  onSave: (patch: Partial<DesktopUpdatePreferences>) => Promise<boolean>
}

export function UpdateSourceSettings({ preferences, source, disabled, onSave }: UpdateSourceSettingsProps) {
  const initialType = source?.type ?? 'github'
  const initialUrl = preferences.customUpdateUrl || (source?.type === 'custom' ? source.url : '')
  const [sourceType, setSourceType] = useState<DesktopUpdateSourceType>(initialType)
  const [customUrl, setCustomUrl] = useState(initialUrl)
  const [saving, setSaving] = useState(false)
  let normalizedUrl = ''
  let validationError = ''
  if (sourceType === 'custom') {
    try {
      normalizedUrl = normalizeUpdateUrl(customUrl)
    } catch (error) {
      validationError = error instanceof Error ? error.message : '更新地址无效。'
    }
  }
  const sourceChanged = !source || sourceType !== source.type
  const urlChanged = sourceType === 'custom' && source?.type === 'custom' && normalizedUrl !== source.url
  const unchanged = !sourceChanged && !urlChanged
  const saveDisabled = disabled || saving || unchanged || Boolean(validationError)
  const controlsDisabled = disabled || saving
  const sourceLabel = source?.type === 'github' ? `${source.owner}/${source.repo}` : source?.url || '尚未配置'

  const handleSourceChange = (value: string | null) => {
    if (isUpdateSourceType(value)) setSourceType(value)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saveDisabled) return
    setSaving(true)
    const patch: Partial<DesktopUpdatePreferences> = { updateSource: sourceType }
    if (sourceType === 'custom') patch.customUpdateUrl = normalizedUrl
    try {
      await onSave(patch)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save}>
      <Flex className='flex-between-wrap gap-4 border-t border-app-border-secondary py-4'>
        <Flex className='flex-col gap-1 min-w-0'>
          <label htmlFor='desktop-update-source'>更新来源</label>
          <Text className='text-xs' type='secondary'>选择客户端更新的获取来源</Text>
          <Text className='break-all text-xs select-text' type='secondary'>当前来源：{sourceLabel}</Text>
        </Flex>
        <Flex className='items-center gap-3'>
          <Select
            id='desktop-update-source'
            className='w-32'
            options={SOURCE_OPTIONS}
            value={sourceType}
            disabled={controlsDisabled}
            onChange={handleSourceChange}
          />
          <Button htmlType='submit' aria-label='保存更新来源' loading={saving} disabled={saveDisabled}>
            保存
          </Button>
        </Flex>
        {sourceType === 'custom' ? (
          <Flex className='flex-col gap-1 w-full'>
            <Input
              aria-label='自定义更新地址'
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'update-source-error' : undefined}
              placeholder='https://cdn.purechat.cn/desktop/'
              value={customUrl}
              disabled={controlsDisabled}
              onChange={(event) => setCustomUrl(event.target.value)}
            />
            {validationError ? (
              <Text id='update-source-error' className='text-xs' type='danger'>{validationError}</Text>
            ) : null}
          </Flex>
        ) : null}
      </Flex>
    </form>
  )
}
