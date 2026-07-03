'use client'

import { Button, Input } from 'antd'
import { useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { updateUser } from '@/libs/better-auth/auth-client'

import { SettingRow } from './SettingRow'

interface UsernameSettingProps {
  username: string | null
  onUpdated: (username: string) => void
}

export function UsernameSetting({ onUpdated, username }: UsernameSettingProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(username ?? '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    const trimmed = value.trim()

    if (!trimmed) {
      message.error('用户名不能为空')
      return
    }

    if (trimmed === username) {
      setEditing(false)
      return
    }

    setLoading(true)

    try {
      const { error } = await updateUser({ name: trimmed })

      if (error) {
        message.error(error.message ?? '用户名更新失败')
        return
      }

      onUpdated(trimmed)
      setEditing(false)
      message.success('用户名已更新')
    } catch {
      message.error('用户名更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setValue(username ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <SettingRow label="用户名">
        <Input
          className="max-w-xs"
          onChange={(event) => setValue(event.target.value)}
          onPressEnter={handleSave}
          value={value}
        />
        <Button loading={loading} onClick={handleSave} size="small" type="primary">
          保存
        </Button>
        <Button disabled={loading} onClick={handleCancel} size="small">
          取消
        </Button>
      </SettingRow>
    )
  }

  return (
    <SettingRow label="用户名">
      <span className="truncate text-sm text-muted-foreground">{username || '-'}</span>
      <Button onClick={() => setEditing(true)} size="small">
        修改
      </Button>
    </SettingRow>
  )
}
