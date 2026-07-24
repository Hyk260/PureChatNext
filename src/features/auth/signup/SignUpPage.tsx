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
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  )
}

export default SignUpPage
