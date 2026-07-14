'use client'

import { Button } from '@lobehub/ui'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'
import AuthCard from '@/features/AuthCard'
import { useAuthConfig } from '@/libs/better-auth/client'

import { VerifyEmailContent } from './VerifyEmailContent'

const VerifyEmailDescription = ({ email }: { email: string | null }) => {
  const { config, ready: configReady } = useAuthConfig()

  if (!configReady) {
    return null
  }

  const target = email || '您的邮箱'

  if (config.emailVerificationMode === 'otp') {
    return `我们已向 ${target} 发送验证码，请在下方输入 6 位验证码完成邮箱验证。`
  }

  return `我们已向 ${target} 发送了一封验证邮件，请点击邮件中的链接完成验证。`
}

const VerifyEmailPageContent = () => {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  return (
    <AuthPageContainer>
      <AuthCard
        footer={
          <Link href="/signin">
            <Button block icon={ChevronLeft} size="large">
              返回登录
            </Button>
          </Link>
        }
        subtitle={<VerifyEmailDescription email={email} />}
        title="验证您的邮箱"
      >
        <VerifyEmailContent callbackUrl={callbackUrl} email={email} />
      </AuthCard>
    </AuthPageContainer>
  )
}

const VerifyEmailPage = () => {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageContent />
    </Suspense>
  )
}

export default VerifyEmailPage
