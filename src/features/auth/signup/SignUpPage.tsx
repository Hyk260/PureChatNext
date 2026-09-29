'use client'

import { Suspense } from 'react'

import Loading from '@/components/Loading/BrandTextLoading'
import { AuthPageContainer } from '@/components/AuthPageContainer'
import { useAuthConfig } from '@/libs/better-auth/client'

import { SignUpForm } from './SignUpForm'

const SignUpContent = () => {
  const { ready: configReady } = useAuthConfig()

  if (!configReady) {
    return <Loading debugId='SignupConfig' />
  }

  return (
    <AuthPageContainer>
      <SignUpForm />
    </AuthPageContainer>
  )
}

const SignUpPage = () => {
  return (
    <div className='h-full min-h-0'>
      <Suspense fallback={null}>
        <SignUpContent />
      </Suspense>
    </div>
  )
}

export default SignUpPage
