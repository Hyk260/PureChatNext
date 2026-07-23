'use client'

import { Button } from 'antd'
import { ChevronLeft } from 'lucide-react'
import Link from '@/utils/link'
import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'
import AuthCard from '@/features/AuthCard'

import { ResetPasswordForm } from './ResetPasswordForm'

const ResetPasswordPageContent = () => {
  return (
    <AuthPageContainer>
      <AuthCard
        footer={
          <Link href='/signin'>
            <Button block icon={<ChevronLeft />} size='large'>
              返回登录
            </Button>
          </Link>
        }
        subtitle='请输入您的新密码'
        title='重置密码'
      >
        <ResetPasswordForm />
      </AuthCard>
    </AuthPageContainer>
  )
}

const ResetPasswordPage = () => {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}

export default ResetPasswordPage
