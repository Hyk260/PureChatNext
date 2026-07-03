'use client'

import { Button, Modal } from 'antd'
import { useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { requestPasswordReset } from '@/libs/better-auth/auth-client'

import { SettingRow } from './SettingRow'

interface PasswordSettingProps {
  email: string | null
  hasCredentialAccount: boolean
}

export function PasswordSetting({ email, hasCredentialAccount }: PasswordSettingProps) {
  const [loading, setLoading] = useState(false)

  const handleReset = () => {
    if (!email) return

    Modal.confirm({
      content: `我们将向 ${email} 发送密码重置链接，请查收邮件后完成重置。`,
      okText: '发送邮件',
      onOk: async () => {
        setLoading(true)

        try {
          const { error } = await requestPasswordReset({
            email,
            redirectTo: `/reset-password?email=${encodeURIComponent(email)}`,
          })

          if (error) {
            message.error(error.message ?? '发送重置邮件失败')
            return
          }

          message.success('密码重置链接已发送到您的邮箱')
        } catch {
          message.error('发送重置邮件失败')
        } finally {
          setLoading(false)
        }
      },
      title: '重置密码',
    })
  }

  if (!hasCredentialAccount || !email) {
    return null
  }

  return (
    <SettingRow label="密码">
      <Button loading={loading} onClick={handleReset} size="small">
        重置密码
      </Button>
    </SettingRow>
  )
}
