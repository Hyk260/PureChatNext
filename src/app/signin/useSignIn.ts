import { Form } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { message } from '@/components/AntdStaticMethods'

import { AUTH_UI_SSO_PROVIDERS, BUILTIN_BETTER_AUTH_PROVIDERS } from '@/libs/better-auth/shared'
import { checkUserByEmail, requestPasswordReset, signIn, useAuthConfig } from '@/libs/better-auth/client'

type Step = 'email' | 'password'

interface SignInFormValues {
  email: string
  password: string
}

const LAST_AUTH_PROVIDER_KEY = 'purechat:last-auth-provider'

export const useSignIn = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { config, ready: serverConfigInit } = useAuthConfig()
  const [form] = Form.useForm<SignInFormValues>()
  const [loading, setLoading] = useState(false)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [isSocialOnly, setIsSocialOnly] = useState(false)
  const [lastAuthProvider, setLastAuthProvider] = useState<string | null>(null)

  const { enableMagicLink, oAuthSSOProviders } = config

  useEffect(() => {
    if (!serverConfigInit) return

    const emailParam = searchParams.get('email')
    if (emailParam) form.setFieldValue('email', emailParam)
  }, [searchParams, form, serverConfigInit])

  useEffect(() => {
    const stored = localStorage.getItem(LAST_AUTH_PROVIDER_KEY)
    if (stored) setLastAuthProvider(stored)
  }, [])

  const handleSendMagicLink = async (targetEmail?: string) => {
    const resolvedEmail = (targetEmail ?? email).trim()
    if (!resolvedEmail) {
      message.error('请输入邮箱')
      return
    }

    setLoading(true)
    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/'
      const { error } = await signIn.magicLink({
        email: resolvedEmail,
        callbackURL: callbackUrl,
      })

      if (error) {
        message.error(error.message ?? '发送登录链接失败')
        return
      }

      message.success('登录链接已发送到您的邮箱，请查收')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckUser = async (values: Pick<SignInFormValues, 'email'>) => {
    const normalizedEmail = values.email.trim().toLowerCase()
    if (!normalizedEmail) {
      message.error('请输入邮箱')
      return
    }

    setLoading(true)
    try {
      const result = await checkUserByEmail(normalizedEmail)

      if (!result.exists) {
        message.info('该邮箱尚未注册，请先创建账户')
        const params = new URLSearchParams({ email: normalizedEmail })
        const callbackUrl = searchParams.get('callbackUrl')
        if (callbackUrl) params.set('callbackUrl', callbackUrl)
        router.push(`/signup?${params.toString()}`)
        return
      }

      setEmail(normalizedEmail)

      if (result.hasPassword) {
        setIsSocialOnly(false)
        setStep('password')
        return
      }

      if (enableMagicLink) {
        await handleSendMagicLink(normalizedEmail)
        return
      }

      setIsSocialOnly(true)
      setStep('password')
    } catch (error) {
      console.error('Check user error:', error)
      message.error('检查账户失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (values: Pick<SignInFormValues, 'password'>) => {
    setLoading(true)
    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/'
      const result = await signIn.email(
        {
          email,
          password: values.password,
          callbackURL: callbackUrl,
        },
        {
          onError: (ctx) => {
            console.error('Sign in error:', ctx.error)
            if (ctx.error.status === 403) {
              router.push(
                `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
              )
            }
          },
          onSuccess: () => router.push(callbackUrl),
        }
      )

      if (result.error && result.error.status !== 403) {
        if (result.error.status === 401 && result.error.code === 'INVALID_EMAIL_OR_PASSWORD') {
          message.error('邮箱或密码错误')
        } else {
          message.error(result.error.message || '登录遇到了问题。请检查账号与密码后重试')
        }
      }
    } catch (error) {
      console.error('Sign in error:', error)
      message.error('登录遇到了问题，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialSignIn = async (provider: string) => {
    try {
      try {
        localStorage.setItem(LAST_AUTH_PROVIDER_KEY, provider)
      } catch {
        // Ignore localStorage errors (e.g., quota exceeded, private mode)
      }
      const callbackUrl = searchParams.get('callbackUrl') || '/'
      const isBuiltin = (BUILTIN_BETTER_AUTH_PROVIDERS as readonly string[]).includes(provider)
      const result = isBuiltin
        ? await signIn.social({
            callbackURL: callbackUrl,
            provider,
          })
        : await signIn.oauth2({
            callbackURL: callbackUrl,
            providerId: provider,
          })

      if (result && 'error' in result && result.error) throw result.error
    } catch (error) {
      console.error(`${provider} sign in error:`, error)
      message.error('登录遇到了问题，请重试')
      throw error
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setIsSocialOnly(false)
  }

  const handleGoToSignup = () => {
    const params = new URLSearchParams()
    if (email) params.set('email', email)
    const query = params.toString()
    router.push(query ? `/signup?${query}` : '/signup')
  }

  const handleForgotPassword = async () => {
    if (forgotPasswordLoading) return

    setForgotPasswordLoading(true)
    try {
      const { error } = await requestPasswordReset({
        email,
        redirectTo: `/reset-password?email=${encodeURIComponent(email)}`,
      })

      if (error) {
        const isRateLimited = error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED'
        message.error(isRateLimited ? '请求过于频繁，请 60 秒后再试' : (error.message ?? '发送重置邮件失败'))
        return
      }

      message.success('密码重置链接已发送到您的邮箱')
    } catch {
      message.error('发送重置邮件失败')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const uiProviders = oAuthSSOProviders.filter((p) => (AUTH_UI_SSO_PROVIDERS as readonly string[]).includes(p))
  const sortedProviders = lastAuthProvider
    ? [...uiProviders].sort((a, b) => {
        if (a === lastAuthProvider) return -1
        if (b === lastAuthProvider) return 1
        return 0
      })
    : uiProviders

  return {
    disableEmailPassword: false,
    email,
    enableMagicLink,
    form,
    handleBackToEmail,
    handleCheckUser,
    forgotPasswordLoading,
    handleForgotPassword,
    handleGoToSignup,
    handleSendMagicLink,
    handleSignIn,
    handleSocialSignIn,
    isSocialOnly,
    lastAuthProvider,
    loading,
    oAuthSSOProviders: sortedProviders,
    serverConfigInit,
    step,
  }
}
