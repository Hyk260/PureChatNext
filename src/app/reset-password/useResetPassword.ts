import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { resetPassword } from '@/libs/better-auth/auth-client'

export interface ResetPasswordFormValues {
  confirmPassword: string
  password: string
}

export const useResetPassword = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  const email = searchParams.get('email')
  const token = searchParams.get('token')

  const handleResetPassword = async (values: ResetPasswordFormValues) => {
    if (!token) {
      message.error('重置链接无效或已过期，请重新申请')
      return
    }

    setLoading(true)

    try {
      const { error } = await resetPassword({
        newPassword: values.password,
        token,
      })

      if (error) {
        message.error(error.message ?? '重置密码失败，请重试')
        return
      }

      message.success('密码已重置，请使用新密码登录')
      const params = new URLSearchParams()
      if (email) params.set('email', email)
      router.push(params.size > 0 ? `/signin?${params.toString()}` : '/signin')
    } catch {
      message.error('重置密码失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return {
    email,
    handleResetPassword,
    loading,
    token,
  }
}
