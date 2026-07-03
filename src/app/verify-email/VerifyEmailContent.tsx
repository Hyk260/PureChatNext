'use client'

import { Button } from '@lobehub/ui'
import { Input } from 'antd'
import { RefreshCw } from 'lucide-react'

import Loading from '@/components/Loading/BrandTextLoading'
import { useAuthConfig } from '@/libs/better-auth/use-auth-config'

import { useVerifyEmail } from './useVerifyEmail'

interface VerifyEmailContentProps {
  callbackUrl: string
  email: string | null
}

export const VerifyEmailContent = ({ email, callbackUrl }: VerifyEmailContentProps) => {
  const { config, ready: configReady } = useAuthConfig()

  if (!configReady) {
    return <Loading debugId="VerifyEmailConfig" />
  }

  if (config.emailVerificationMode === 'otp') {
    return (
      <VerifyEmailOtpContent
        callbackUrl={callbackUrl}
        email={email}
        mode={config.emailVerificationMode}
      />
    )
  }

  return (
    <VerifyEmailLinkContent
      callbackUrl={callbackUrl}
      email={email}
      mode={config.emailVerificationMode}
    />
  )
}

interface VerifyEmailModeContentProps extends VerifyEmailContentProps {
  mode: 'link' | 'otp'
}

const VerifyEmailOtpContent = ({ email, callbackUrl, mode }: VerifyEmailModeContentProps) => {
  const {
    expirationText,
    handleResend,
    handleVerify,
    otp,
    resending,
    setOtp,
    verifying,
  } = useVerifyEmail({ callbackUrl, email, mode })

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        请输入发送到邮箱的 6 位验证码。验证码将在 {expirationText} 后过期；如未收到，请检查垃圾邮件文件夹。
      </div>

      <div className="flex justify-center">
        <Input.OTP length={6} size="large" value={otp} onChange={setOtp} />
      </div>

      <Button block loading={verifying} onClick={handleVerify} size="large" type="primary">
        验证邮箱
      </Button>

      <Button
        block
        icon={<RefreshCw size={16} />}
        loading={resending}
        onClick={handleResend}
        size="large"
        type="default"
      >
        重新发送验证码
      </Button>
    </div>
  )
}

const VerifyEmailLinkContent = ({ email, callbackUrl, mode }: VerifyEmailModeContentProps) => {
  const { handleResend, resending } = useVerifyEmail({ callbackUrl, email, mode })

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        如果没有收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送。
      </div>

      <Button
        block
        icon={<RefreshCw size={16} />}
        loading={resending}
        onClick={handleResend}
        size="large"
        type="default"
      >
        重新发送验证邮件
      </Button>
    </div>
  )
}
