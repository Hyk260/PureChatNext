import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { toast } from '@lobehub/ui'
import {
  checkUserByEmail,
  reclaimUnverifiedEmail,
  sendVerificationEmail,
  signUp,
  useAuthConfig,
} from '@/libs/better-auth/client'
import { markFirstConversion, trackAcquisitionEvent } from '@/libs/analytics/acquisition'
import { getReferralContext, isReferralCallback } from '@/libs/referrals/helpers'
import { resolveCallbackUrl } from '@/utils/safeCallbackUrl'

export interface SignUpFormValues {
  confirmPassword: string
  email: string
  password: string
  referralCode?: string
}

interface SignUpErrorLike {
  code?: string
  details?: {
    cause?: {
      constraint_name?: string
    }
  }
  message?: string
}

const isEmailDuplicateSignupError = (error: SignUpErrorLike) => {
  if (error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' || error.code === 'USER_ALREADY_EXISTS') {
    return true
  }
  return error.details?.cause?.constraint_name === 'users_email_unique'
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
  const [referralError, setReferralError] = useState('')

  const handleSignUp = async (values: SignUpFormValues) => {
    setLoading(true)
    setReferralError('')

    try {
      const email = values.email.trim().toLowerCase()
      const callbackUrl = resolveCallbackUrl(searchParams.get('callbackUrl'))
      const referralContext = getReferralContext(searchParams)
      const referralCode = values.referralCode?.trim() ?? ''
      const invited = Boolean(referralContext || referralCode || isReferralCallback(callbackUrl))

      const verifyAccount = async (forceSend = false) => {
        if ((!config.enableEmailVerification || forceSend) && config.emailVerificationMode === 'link') {
          try {
            const verification = await sendVerificationEmail({ email, callbackURL: callbackUrl })
            if (verification.error) toast.warning('账号已创建，验证邮件发送失败，请在验证页重试')
          } catch {
            toast.warning('账号已创建，验证邮件发送失败，请在验证页重试')
          }
        }
        router.push(`/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`)
      }

      const existingUser = await checkUserByEmail(email)
      if (existingUser.exists) {
        if (existingUser.emailVerified) {
          toast.info('该邮箱已注册，请前往登录')
          redirectToSignIn(router, searchParams, email)
          return
        }

        if (invited) {
          toast.info('该邮箱已注册，请验证邮箱；已有邀请归属不会更改')
          await verifyAccount(true)
          return
        }

        // 未验证占坑：回收后按首次注册继续走验证
        await reclaimUnverifiedEmail(email, values.password)
      }

      const name = email.split('@')[0] ?? email

      const { error } = await signUp.email(
        {
          callbackURL: callbackUrl,
          email,
          name,
          password: values.password,
        },
        { body: { referralCode, referralContext } }
      )

      if (error) {
        const signUpError = error as SignUpErrorLike
        if (signUpError.code === 'INVALID_REFERRAL_CODE' || signUpError.code === 'INVALID_REFERRAL_CONTEXT') {
          setReferralError(signUpError.message || '邀请信息无效，请检查后重试')
          return
        }

        if (isEmailDuplicateSignupError(signUpError)) {
          toast.info('该邮箱已注册，请前往登录')
          redirectToSignIn(router, searchParams, email)
          return
        }

        if (signUpError.code === 'INVALID_EMAIL' || signUpError.message === 'Invalid email') {
          toast.error('请输入有效的邮箱地址')
          return
        }

        toast.error(signUpError.message || '注册失败，请重试')
        return
      }

      trackAcquisitionEvent('sign_up_completed', {
        email_verification: config.enableEmailVerification,
        first: markFirstConversion('sign_up'),
      })

      if (config.enableEmailVerification || invited) {
        await verifyAccount()
        return
      }

      router.push(callbackUrl)
    } catch {
      toast.error('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return { configReady, loading, referralError, onSubmit: handleSignUp }
}
