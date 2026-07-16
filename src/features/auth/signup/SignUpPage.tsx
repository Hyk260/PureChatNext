'use client'

import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'

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
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  )
}

export default SignUpPage
