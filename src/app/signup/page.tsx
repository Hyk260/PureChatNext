'use client'

import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'
import Loading from '@/components/Loading/BrandTextLoading'

import { SignUpForm } from './SignUpForm'

const SignUpContent = () => {
  return (
    <AuthPageContainer>
      <SignUpForm />
    </AuthPageContainer>
  )
}

const SignUpPage = () => {
  return (
    <Suspense fallback={<Loading debugId="Signup" />}>
      <SignUpContent />
    </Suspense>
  )
}

export default SignUpPage
