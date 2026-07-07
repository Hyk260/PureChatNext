import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { emailOtp, sendVerificationEmail } from '@/libs/better-auth/auth-client'
import { OTP_EXPIRES_IN } from '@/libs/better-auth/constants'
import { formatExpirationText } from '@/libs/better-auth/email-templates/utils/format-expiration-text'
import type { EmailVerificationMode } from '@/libs/better-auth/get-auth-config'

interface UseVerifyEmailParams {
  callbackUrl: string
  email: string | null
  mode: EmailVerificationMode
}

export const useVerifyEmail = ({ email, callbackUrl, mode }: UseVerifyEmailParams) => {
  const router = useRouter()
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const initialOtpSendRef = useRef(false)

  const sendOtp = useCallback(async () => {
    if (!email) {
      message.error('缺少邮箱地址，请返回登录页重试')
      return false
    }

    setSending(true)
    try {
      const result = await emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      })

      if (result.error) {
        if (result.error.status === 429 && result.error.statusText === 'Too Many Requests') {
          message.error('发送验证码过于频繁，请稍后重试')
          return false
        }
        message.error(result.error.message || '发送验证码失败，请稍后重试')
        return false
      }

      message.success('验证码已发送，请查收邮箱')
      return true
    } catch (error) {
      console.error('Error sending verification OTP:', error)
      message.error('发送验证码失败，请稍后重试')
      return false
    } finally {
      setSending(false)
    }
  }, [email])

  const resendLinkEmail = useCallback(async () => {
    if (!email) {
      message.error('缺少邮箱地址，请返回登录页重试')
      return false
    }

    setSending(true)
    try {
      const result = await sendVerificationEmail({ callbackURL: callbackUrl, email })

      if (result.error) {
        message.error(result.error.message || '发送验证邮件失败，请稍后重试')
        return false
      }

      message.success('验证邮件已重新发送，请查收邮箱')
      return true
    } catch (error) {
      console.error('Error resending verification email:', error)
      message.error('发送验证邮件失败，请稍后重试')
      return false
    } finally {
      setSending(false)
    }
  }, [callbackUrl, email])

  useEffect(() => {
    if (mode !== 'otp' || !email || initialOtpSendRef.current) return

    initialOtpSendRef.current = true
    sendOtp()
  }, [email, mode, sendOtp])

  const handleVerify = async () => {
    if (!email) {
      message.error('缺少邮箱地址，请返回登录页重试')
      return
    }

    if (otp.length !== 6) {
      message.error('请输入 6 位验证码')
      return
    }

    setVerifying(true)
    try {
      const result = await emailOtp.verifyEmail({ email, otp })

      if (result.error) {
        message.error(result.error.message || '验证失败，请检查验证码后重试')
        return
      }

      message.success('邮箱验证成功')
      router.push(callbackUrl)
    } catch (error) {
      console.error('Error verifying email OTP:', error)
      message.error('验证失败，请稍后重试')
    } finally {
      setVerifying(false)
    }
  }

  return {
    expirationText: formatExpirationText(OTP_EXPIRES_IN),
    handleResend: mode === 'otp' ? sendOtp : resendLinkEmail,
    handleVerify,
    mode,
    otp,
    resending: sending,
    setOtp,
    verifying,
  }
}
