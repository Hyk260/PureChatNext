'use client'

import { Card } from 'antd'
import Link from 'next/link'
import { Suspense } from 'react'

import Loading from '@/components/Loading/BrandTextLoading'

import { ResetPasswordForm } from './ResetPasswordForm'

const ResetPasswordPageContent = () => {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card title={<div className="text-2xl">重置密码</div>}>
          <div className="mb-4 text-sm text-muted-foreground">请输入您的新密码</div>
          <ResetPasswordForm />
          <div className="mt-6 text-center text-sm">
            <Link className="underline underline-offset-4" href="/signin">
              返回登录
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}

const ResetPasswordPage = () => {
  return (
    <Suspense fallback={<Loading debugId="ResetPassword" />}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}

export default ResetPasswordPage
