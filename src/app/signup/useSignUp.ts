import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { signUp } from '@/libs/better-auth/auth-client'
import { checkUserByEmail } from '@/libs/better-auth/check-user'
import { useAuthConfig } from '@/libs/better-auth/use-auth-config'

export interface SignUpFormValues {
  confirmPassword: string
  email: string
  password: string
}

interface SignUpErrorLike {
  code?: string
  details?: {
    cause?: {
      code?: string
    }
  }
  message?: string
}

export const useSignUp = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { config, ready: configReady } = useAuthConfig()
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (values: SignUpFormValues) => {
    setLoading(true)

    try {
      const email = values.email.trim().toLowerCase()
      const callbackUrl = searchParams.get('callbackUrl') || '/'

      const existingUser = await checkUserByEmail(email)
      if (existingUser.exists) {
        message.info('该邮箱已注册，请前往登录')
        const params = new URLSearchParams({ email })
        const callbackUrlParam = searchParams.get('callbackUrl')
        if (callbackUrlParam) params.set('callbackUrl', callbackUrlParam)
        router.push(`/signin?${params.toString()}`)
        return
      }

      const name = email.split('@')[0] ?? email

      const result = await signUp.email({
        callbackURL: callbackUrl,
        email,
        name,
        password: values.password,
      })

      const error = result?.error

      if (error) {
        const signUpError = error as SignUpErrorLike
        const isEmailDuplicate =
          signUpError.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ||
          (signUpError.code === 'FAILED_TO_CREATE_USER' &&
            signUpError.details?.cause?.code === '23505')

        if (isEmailDuplicate) {
          message.info('该邮箱已注册，请前往登录')
          const params = new URLSearchParams({ email })
          const callbackUrl = searchParams.get('callbackUrl')
          if (callbackUrl) params.set('callbackUrl', callbackUrl)
          router.push(`/signin?${params.toString()}`)
          return
        }

        if (signUpError.code === 'INVALID_EMAIL' || signUpError.message === 'Invalid email') {
          message.error('请输入有效的邮箱地址')
          return
        }

        message.error(signUpError.message || '注册失败，请重试')
        return
      }

      if (config.enableEmailVerification) {
        router.push(
          `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
        )
        return
      }

      router.push(callbackUrl)
    } catch {
      message.error('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return { configReady, loading, onSubmit: handleSignUp }
}
