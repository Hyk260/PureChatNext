import { useRouter, useSearchParams } from '@/utils/navigation'
import { useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { checkUserByEmail, reclaimUnverifiedEmail, signUp, useAuthConfig } from '@/libs/better-auth/client'
import { resolveCallbackUrl } from '@/utils/safeCallbackUrl'

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

const redirectToSignIn = (
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  email: string
) => {
  const params = new URLSearchParams({ email })
  const callbackUrl = resolveCallbackUrl(searchParams.get('callbackUrl'), '')
  if (callbackUrl) params.set('callbackUrl', callbackUrl)
  router.push(`/signin?${params.toString()}`)
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
      const callbackUrl = resolveCallbackUrl(searchParams.get('callbackUrl'))

      const existingUser = await checkUserByEmail(email)
      if (existingUser.exists) {
        if (existingUser.emailVerified) {
          message.info('该邮箱已注册，请前往登录')
          redirectToSignIn(router, searchParams, email)
          return
        }

        // 未验证占坑：回收后按首次注册继续走验证
        await reclaimUnverifiedEmail(email)
      }

      const name = email.split('@')[0] ?? email

      const { error } = await signUp.email({
        callbackURL: callbackUrl,
        email,
        name,
        password: values.password,
      })

      if (error) {
        const signUpError = error as SignUpErrorLike
        const isEmailDuplicate =
          signUpError.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ||
          (signUpError.code === 'FAILED_TO_CREATE_USER' && signUpError.details?.cause?.code === '23505')

        if (isEmailDuplicate) {
          message.info('该邮箱已注册，请前往登录')
          redirectToSignIn(router, searchParams, email)
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
        router.push(`/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`)
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
