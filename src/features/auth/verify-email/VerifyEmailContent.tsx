'use client'

import { Block, Button, Flexbox, Text } from '@lobehub/ui'
import { Input } from 'antd'
import { RefreshCw } from 'lucide-react'

import Loading from '@/components/Loading/BrandTextLoading'
import { useAuthConfig } from '@/libs/better-auth/client'

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
    <Flexbox gap={16}>
      <Block padding={24}>
        <Text align="center">
          验证码将在 {expirationText} 后过期；如未收到，请检查垃圾邮件文件夹。
        </Text>
      </Block>

      <Flexbox align="center" justify="center">
        <Input.OTP length={6} size="large" value={otp} onChange={setOtp} />
      </Flexbox>

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
    </Flexbox>
  )
}

const VerifyEmailLinkContent = ({ email, callbackUrl, mode }: VerifyEmailModeContentProps) => {
  const { handleResend, resending } = useVerifyEmail({ callbackUrl, email, mode })

  return (
    <Flexbox gap={16}>
      <Block padding={24}>
        <Text align="center">如果没有收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送。</Text>
      </Block>

      <Button
        icon={<RefreshCw size={16} />}
        loading={resending}
        onClick={handleResend}
        size="large"
        type="default"
      >
        重新发送验证邮件
      </Button>
    </Flexbox>
  )
}
