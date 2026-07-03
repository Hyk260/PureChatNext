'use client'

import { Card } from 'antd'
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
