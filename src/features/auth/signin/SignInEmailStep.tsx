'use client'

import { Alert, Badge, Divider } from '@lobehub/ui'
import { Form } from '@lobehub/ui/form'
import type { FormInstance } from '@lobehub/ui/form'
import { User } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Flex, Icon, Input, Skeleton, Text } from '@pure/ui'
import AuthIcons from '@/components/AuthIcons'
import { BRANDING_NAME } from '@/const/branding'
import AuthAgreement, { withAuthAgreement } from '@/features/AuthAgreement'
import { AuthCard } from '@/features/AuthCard'
import { SSO_PROVIDER_LABELS } from '@/libs/better-auth/shared'

interface SignInFormValues {
  email: string
  password: string
}

interface SignInEmailStepProps {
  /** 是否禁用邮箱密码登录 */
  disableEmailPassword?: boolean
  form: FormInstance<SignInFormValues>
  isSocialOnly?: boolean
  lastAuthProvider?: string | null
  loading: boolean
  oAuthSSOProviders: readonly string[]
  onSocialSignIn: (provider: string) => Promise<void>
  serverConfigInit: boolean
}

const PROVIDER_ICON_STYLE: CSSProperties = {
  left: 12,
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
}

const getProviderLabel = (provider: string) => {
  const label = SSO_PROVIDER_LABELS[provider] ?? provider
  return `使用 ${label} 登录`
}

const withLastUsedBadge = (node: ReactNode, enabled: boolean) =>
  enabled ? (
    <Badge className='block w-full pt-2' color='var(--lobe-color-info)' count='上次使用'>
      {node}
    </Badge>
  ) : (
    node
  )

export const SignInEmailStep = ({
  disableEmailPassword,
  form,
  isSocialOnly,
  lastAuthProvider,
  loading,
  oAuthSSOProviders,
  onSocialSignIn,
  serverConfigInit,
}: SignInEmailStepProps) => {
  const emailInputRef = useRef<HTMLInputElement>(null)
  const pendingProviderRef = useRef<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const signupHref = query ? `/signup?${query}` : '/signup'

  const canShowLastUsedBadge = useMemo(
    () => oAuthSSOProviders.length > 1 || (oAuthSSOProviders.length === 1 && !disableEmailPassword),
    [disableEmailPassword, oAuthSSOProviders.length]
  )

  const handleProviderClick = useCallback(
    async (provider: string) => {
      if (pendingProviderRef.current) return

      pendingProviderRef.current = provider
      setPendingProvider(provider)

      try {
        await onSocialSignIn(provider)
      } catch {
        pendingProviderRef.current = null
        setPendingProvider(null)
      }
    },
    [onSocialSignIn]
  )

  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  const divider = (
    <Divider>
      <Text className='text-[12px]' type='secondary'>
        或继续使用
      </Text>
    </Divider>
  )

  return (
    <AuthCard title={`登录 ${BRANDING_NAME} 账号`}>
      <Flex className='flex-col gap-3'>
        {!serverConfigInit && (
          <>
            <Skeleton animated height={40} width='100%' />
            <Skeleton animated height={40} width='100%' />
            {divider}
          </>
        )}

        {serverConfigInit && oAuthSSOProviders.length > 0 && (
          <Flex className='flex-col gap-3 w-full'>
            {oAuthSSOProviders.map((provider) => {
              const button = (
                <Button
                  block
                  disabled={pendingProvider !== null}
                  icon={<span style={PROVIDER_ICON_STYLE}>{AuthIcons(provider, 18)}</span>}
                  loading={pendingProvider === provider}
                  size='large'
                  type='fill'
                  onClick={() => {
                    withAuthAgreement(() => {
                      handleProviderClick(provider)
                    })
                  }}
                >
                  {getProviderLabel(provider)}
                </Button>
              )

              return (
                <div key={provider}>
                  {withLastUsedBadge(button, provider === lastAuthProvider && canShowLastUsedBadge)}
                </div>
              )
            })}
            {!disableEmailPassword && divider}
          </Flex>
        )}

        {serverConfigInit && disableEmailPassword && oAuthSSOProviders.length === 0 && (
          <Alert showIcon title='未配置可用的第三方登录方式' type='warning' />
        )}

        {!disableEmailPassword && (
          <Form form={form} layout='vertical'>
            <Form.Field name='email'>
              <Input
                placeholder='请输入邮箱或用户名'
                prefix={<Icon icon={User} />}
                ref={emailInputRef}
                size='large'
                onPressEnter={(event) => {
                  event.preventDefault()
                  form.submit()
                }}
              />
            </Form.Field>
          </Form>
        )}

        {isSocialOnly && <Alert showIcon title='此账户未设置密码，请使用第三方登录或魔法链接登录。' type='info' />}

        <Flex className='flex-col gap-4 py-1'>
          <AuthAgreement />
          {!disableEmailPassword && (
            <Button block loading={loading} size='large' type='primary' onClick={() => form.submit()}>
              下一步
            </Button>
          )}
        </Flex>
        <Text className='w-full text-center'>
          还没有账号？ <Link href={signupHref}>创建账号</Link>
        </Text>
      </Flex>
    </AuthCard>
  )
}
