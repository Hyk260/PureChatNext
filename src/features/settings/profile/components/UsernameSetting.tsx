'use client'

import { Input } from 'antd'
import type { InputRef } from 'antd'
import { Button, Text, Flexbox } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { checkUsernameTaken, updateUser } from '@/libs/better-auth/client'
import { LOGIN_USERNAME_REGEX } from '@/libs/better-auth/shared'

import { SettingRow } from './SettingRow'

interface UsernameSettingProps {
  username: string | null
  onUpdated: (username: string) => void
}

const isUsernameConflictError = (error: { code?: string | null; message?: string | null }) => {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return text.includes('23505') || text.includes('users_username_unique')
}

export function UsernameSetting({ onUpdated, username }: UsernameSettingProps) {
  const { message } = useApp()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const inputRef = useRef<InputRef>(null)

  const validateUsername = (value: string) => {
    const trimmed = value.trim()

    if (!trimmed) return '用户名不能为空'
    if (trimmed.length > 64) return '用户名不能超过 64 个字符'
    if (!LOGIN_USERNAME_REGEX.test(trimmed)) return '用户名只能包含字母、数字和下划线'

    return ''
  }

  const handleSave = useCallback(async () => {
    const value = inputRef.current?.input?.value?.trim()

    if (!value || value === username) {
      setError('')
      setDirty(false)
      return
    }

    const validationError = validateUsername(value)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      if (await checkUsernameTaken(value)) {
        setError('该用户名已被占用')
        return
      }

      const { error: updateError } = await updateUser({ name: value })

      if (updateError) {
        setError(isUsernameConflictError(updateError) ? '该用户名已被占用' : (updateError.message ?? '用户名更新失败'))
        return
      }

      onUpdated(value)
      setDirty(false)
      message.success('用户名已更新')
    } catch {
      setError('用户名更新失败')
    } finally {
      setSaving(false)
    }
  }, [message, onUpdated, username])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setDirty(value.trim() !== (username || ''))

    if (!value.trim()) {
      setError('')
      return
    }

    if (!LOGIN_USERNAME_REGEX.test(value)) {
      setError('用户名只能包含字母、数字和下划线')
      return
    }

    setError('')
  }

  const handleCancel = useCallback(() => {
    if (inputRef.current?.input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      nativeInputValueSetter?.call(inputRef.current.input, username || '')
      inputRef.current.input.dispatchEvent(new Event('input', { bubbles: true }))
    }

    setError('')
    setDirty(false)
    inputRef.current?.blur()
  }, [username])

  return (
    <SettingRow label='用户名'>
      <Flexbox horizontal align='center' gap={8} style={{ minWidth: 0, width: '100%' }}>
        {saving ? <Loader2 className='h-4 w-4 shrink-0 animate-spin' /> : null}
        {error ? (
          <Text type='danger' style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {error}
          </Text>
        ) : null}
        {dirty && !saving ? (
          <Button
            onMouseDown={(event) => {
              event.preventDefault()
              handleCancel()
            }}
            size='small'
          >
            取消
          </Button>
        ) : null}
        <Input
          defaultValue={username || ''}
          disabled={saving}
          key={username}
          onBlur={handleSave}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              handleCancel()
            }
          }}
          onPressEnter={handleSave}
          placeholder='字母、数字或下划线'
          ref={inputRef}
          status={error ? 'error' : undefined}
          style={{ flex: 1, maxWidth: 320 }}
          variant='filled'
        />
      </Flexbox>
    </SettingRow>
  )
}
