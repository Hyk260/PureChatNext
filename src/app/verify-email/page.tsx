'use client'

import { Button } from '@lobehub/ui'
import { Card } from 'antd'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import Loading from '@/components/Loading/BrandTextLoading'
import { useAuthConfig } from '@/libs/better-auth/use-auth-config'

import { VerifyEmailContent } from './VerifyEmailContent'

const VerifyEmailDescription = ({ email }: { email: string | null }) => {
  const { config, ready: configReady } = useAuthConfig()

  if (!configReady) {
    return null
  }

  const target = email || '您的邮箱'

  if (config.emailVerificationMode === 'otp') {
    return (
      <>
        我们已向 <span className="font-medium text-foreground">{target}</span>{' '}
        发送验证码，请在下方输入 6 位验证码完成邮箱验证。
      </>
    )
  }

  return (
    <>
      我们已向 <span className="font-medium text-foreground">{target}</span>{' '}
      发送了一封验证邮件，请点击邮件中的链接完成验证。
    </>
  )
}

const VerifyEmailPageContent = () => {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card title={<div className="text-2xl">验证您的邮箱</div>}>
          <div className="mb-6 text-sm text-muted-foreground">
            <VerifyEmailDescription email={email} />
          </div>
          <VerifyEmailContent callbackUrl={callbackUrl} email={email} />
          <div className="mt-6">
            <Link href="/signin">
              <Button block icon={ChevronLeft} size="large">
                返回登录
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}

const VerifyEmailPage = () => {
  return (
    <Suspense fallback={<Loading debugId="VerifyEmail" />}>
      <VerifyEmailPageContent />
    </Suspense>
  )
}

export default VerifyEmailPage
