'use client'

import { Flex, Input } from '@pure/ui'
import type { InputRef } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { patchUserProfile } from './patchUserProfile'
import { SettingRow } from './SettingRow'

interface FullNameSettingProps {
  fullName: string | null
  onUpdated: (fullName: string | null) => void
}

export function FullNameSetting({ fullName, onUpdated }: FullNameSettingProps) {
  const { message } = useApp()
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<InputRef>(null)

  const handleSave = useCallback(async () => {
    const value = inputRef.current?.input?.value?.trim() ?? ''
    const next = value || null

    if (next === (fullName || null) || (!value && !fullName)) return

    setSaving(true)

    try {
      const result = await patchUserProfile({ fullName: next })
      onUpdated(result.fullName)
      message.success('全名已更新')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '全名更新失败')
    } finally {
      setSaving(false)
    }
  }, [fullName, message, onUpdated])

  return (
    <SettingRow label='全名'>
      <Flex className='flex-row items-center gap-2 min-w-[0px] w-full'>
        {saving ? <Loader2 className='h-4 w-4 shrink-0 animate-spin' /> : null}
        <Input
          defaultValue={fullName || ''}
          disabled={saving}
          key={fullName}
          onBlur={handleSave}
          onPressEnter={handleSave}
          placeholder='全名'
          ref={inputRef}
          style={{ flex: 1, maxWidth: 320 }}
          variant='filled'
        />
      </Flex>
    </SettingRow>
  )
}
