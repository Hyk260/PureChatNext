'use client'

import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'
import Loading from '@/components/Loading/BrandTextLoading'

import { SignInEmailStep } from './SignInEmailStep'
import { SignInPasswordStep } from './SignInPasswordStep'
import { useSignIn } from './useSignIn'

const SignInContent = () => {
  const {
    disableEmailPassword,
    email,
    enableMagicLink,
    form,
    forgotPasswordLoading,
    handleBackToEmail,
    handleCheckUser,
    handleForgotPassword,
    handleSendMagicLink,
    handleSignIn,
    handleSocialSignIn,
    isSocialOnly,
    lastAuthProvider,
    loading,
    oAuthSSOProviders,
    serverConfigInit,
    step,
  } = useSignIn()

  if (!serverConfigInit) {
    return (
      <AuthPageContainer>
        <Loading debugId="SigninConfig" />
      </AuthPageContainer>
    )
  }

  return (
    <AuthPageContainer>
      {step === 'email' ? (
        <SignInEmailStep
          disableEmailPassword={disableEmailPassword}
          form={form}
          isSocialOnly={isSocialOnly}
          lastAuthProvider={lastAuthProvider}
          loading={loading}
          oAuthSSOProviders={oAuthSSOProviders}
          serverConfigInit={serverConfigInit}
          onCheckUser={handleCheckUser}
          onSocialSignIn={handleSocialSignIn}
        />
      ) : (
        <SignInPasswordStep
          email={email}
          enableMagicLink={enableMagicLink}
          forgotPasswordLoading={forgotPasswordLoading}
          form={form}
          isSocialOnly={isSocialOnly}
          loading={loading}
          oAuthSSOProviders={oAuthSSOProviders}
          onBack={handleBackToEmail}
          onForgotPassword={handleForgotPassword}
          onSendMagicLink={handleSendMagicLink}
          onSignIn={handleSignIn}
        />
      )}
    </AuthPageContainer>
  )
}

const SignInPage = () => {
  return (
    <Suspense fallback={<Loading debugId="Signin" />}>
      <SignInContent />
    </Suspense>
  )
}

export default SignInPage
