'use client'

import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'
import Loading from '@/components/Loading/BrandTextLoading'

import { SignInEmailStep } from './SignInEmailStep'
import { SignInPasswordStep } from './SignInPasswordStep'
import { useSignIn } from './useSignIn'

const SignInContent = () => {
  const {
    accountLabel,
    disableEmailPassword,
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
    return <Loading debugId='SigninConfig' />
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
          accountLabel={accountLabel}
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
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  )
}

export default SignInPage
