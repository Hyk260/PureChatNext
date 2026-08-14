'use client'

import { Alert, Badge, Divider, Form, Input, Skeleton } from 'antd'
import type { FormInstance, InputRef } from 'antd'
import { ChevronRight, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Icon, Text, Flexbox } from '@pure/ui'
import AuthIcons from '@/components/AuthIcons'
import { BRANDING_NAME } from '@/const/branding'
import AuthAgreement from '@/features/AuthAgreement'
import { AuthCard } from '@/features/AuthCard'
import { SSO_PROVIDER_LABELS, normalizeLoginIdentifier } from '@/libs/better-auth/shared'

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
  onCheckUser: (values: Pick<SignInFormValues, 'email'>) => Promise<void>
  onSocialSignIn: (provider: string) => Promise<void>
  serverConfigInit: boolean
}

const PROVIDER_ICON_STYLE: CSSProperties = { left: 12, position: 'absolute', top: 13 }
const INPUT_ICON_STYLE: CSSProperties = { marginInline: 6 }
const EMAIL_INPUT_STYLE: CSSProperties = { padding: 6 }
const LAST_USED_BADGE_STYLES = {
  root: { display: 'block', paddingTop: 8, width: '100%' },
}

const getProviderLabel = (provider: string) => {
  const label = SSO_PROVIDER_LABELS[provider] ?? provider
  return `使用 ${label} 登录`
}

const withLastUsedBadge = (node: ReactNode, enabled: boolean) =>
  enabled ? (
    <Badge color='var(--ant-color-info)' count='上次使用' styles={LAST_USED_BADGE_STYLES}>
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
  onCheckUser,
  onSocialSignIn,
  serverConfigInit,
}: SignInEmailStepProps) => {
  const emailInputRef = useRef<InputRef>(null)
  const pendingProviderRef = useRef<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<string | null>(null)

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
      <Text type='secondary' style={{ fontSize: 12 }}>
        或继续使用
      </Text>
    </Divider>
  )

  return (
    <AuthCard title={`登录或注册你的 ${BRANDING_NAME} 账号`}>
      <Flexbox gap={12}>
        {!serverConfigInit && (
          <>
            <Skeleton.Button active block size='large' />
            <Skeleton.Button active block size='large' />
            {divider}
          </>
        )}

        {serverConfigInit && oAuthSSOProviders.length > 0 && (
          <Flexbox gap={12} style={{ width: '100%' }}>
            {oAuthSSOProviders.map((provider) => {
              const button = (
                <Button
                  block
                  disabled={pendingProvider !== null}
                  icon={<Icon icon={AuthIcons(provider, 18)} style={PROVIDER_ICON_STYLE} />}
                  loading={pendingProvider === provider}
                  size='large'
                  type='fill'
                  onClick={() => {
                    handleProviderClick(provider)
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
          </Flexbox>
        )}

        {serverConfigInit && disableEmailPassword && oAuthSSOProviders.length === 0 && (
          <Alert showIcon message='未配置可用的第三方登录方式' type='warning' />
        )}

        {!disableEmailPassword && (
          <Form form={form} layout='vertical' onFinish={onCheckUser}>
            <Form.Item
              name='email'
              rules={[
                { message: '请输入邮箱或用户名', required: true },
                {
                  validator: async (_, value: string) => {
                    const raw = value?.trim() ?? ''
                    if (!raw) return
                    if (normalizeLoginIdentifier(raw)) return
                    if (raw.includes('@')) throw new Error('请输入有效的邮箱地址')
                    throw new Error('用户名只能包含字母、数字和下划线')
                  },
                },
              ]}
              style={{ marginBottom: 0 }}
            >
              <Input
                placeholder='请输入邮箱或用户名'
                prefix={<Icon icon={User} style={INPUT_ICON_STYLE} />}
                ref={emailInputRef}
                size='large'
                style={EMAIL_INPUT_STYLE}
                suffix={
                  <Button
                    icon={ChevronRight}
                    loading={loading}
                    title='下一步'
                    type='fill'
                    onClick={() => form.submit()}
                  />
                }
              />
            </Form.Item>
          </Form>
        )}

        {isSocialOnly && <Alert showIcon message='此账户未设置密码，请使用第三方登录或魔法链接登录。' type='info' />}

        {/* <AuthAgreement /> */}
      </Flexbox>
    </AuthCard>
  )
}
