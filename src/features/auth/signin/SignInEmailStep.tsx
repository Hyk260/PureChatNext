'use client'

import { BRANDING_NAME } from '@/const/branding'
import AuthIcons from '@/components/AuthIcons'
import AuthAgreement from '@/features/AuthAgreement'
import { AuthCard } from '@/features/AuthCard'
import { SSO_PROVIDER_LABELS } from '@/libs/better-auth/shared'
import { Alert, Button, Flexbox, Icon, Input, Skeleton, Text } from '@lobehub/ui'
import { Badge, Button as AntdButton, Divider, Form } from 'antd'
import { ChevronRight, Mail } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import type { FormInstance, InputRef } from 'antd'

interface SignInFormValues {
  email: string
  password: string
}

interface SignInEmailStepProps {
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

const getProviderLabel = (provider: string) => {
  const label = SSO_PROVIDER_LABELS[provider] ?? provider
  return `使用 ${label} 登录`
}

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

  const handleProviderClick = useCallback(
    (provider: string) => {
      if (pendingProviderRef.current) return

      pendingProviderRef.current = provider
      setPendingProvider(provider)

      void onSocialSignIn(provider).catch(() => {
        pendingProviderRef.current = null
        setPendingProvider(null)
      })
    },
    [onSocialSignIn]
  )

  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  const divider = (
    <Divider>
      <Text fontSize={12} type="secondary">
        或继续使用
      </Text>
    </Divider>
  )

  return (
    <AuthCard title={`登录或注册你的 ${BRANDING_NAME} 账号`}>
      <Flexbox gap={12}>
        {!serverConfigInit && (
          <>
            <Skeleton.Button active block size="large" />
            <Skeleton.Button active block size="large" />
            {divider}
          </>
        )}
        {serverConfigInit && oAuthSSOProviders.length > 0 && (
          <Flexbox gap={12} width="100%">
            {oAuthSSOProviders.map((provider) => {
              const isProviderLoading = pendingProvider === provider
              const button = (
                <AntdButton
                  block
                  disabled={pendingProvider !== null}
                  icon={<Icon icon={AuthIcons(provider, 18)} style={PROVIDER_ICON_STYLE} />}
                  key={provider}
                  loading={isProviderLoading}
                  size="large"
                  onClick={() => handleProviderClick(provider)}
                >
                  {getProviderLabel(provider)}
                </AntdButton>
              )
              const showLastUsed =
                provider === lastAuthProvider &&
                (oAuthSSOProviders.length > 1 ||
                  (oAuthSSOProviders.length === 1 && !disableEmailPassword))
              return showLastUsed ? (
                <Badge
                  color="var(--ant-color-info)"
                  count="上次使用"
                  key={provider}
                  styles={{ root: { display: 'block', paddingTop: 8, width: '100%' } }}
                >
                  {button}
                </Badge>
              ) : (
                button
              )
            })}
            {!disableEmailPassword && divider}
          </Flexbox>
        )}
        {serverConfigInit && disableEmailPassword && oAuthSSOProviders.length === 0 && (
          <Alert showIcon description="未配置可用的第三方登录方式" type="warning" />
        )}
        {!disableEmailPassword && (
          <Form form={form} layout="vertical" onFinish={onCheckUser}>
            <Form.Item
              name="email"
              rules={[
                { message: '请输入邮箱', required: true },
                { message: '请输入有效的邮箱地址', type: 'email' },
              ]}
              style={{ marginBottom: 0 }}
            >
              <Input
                placeholder="请输入邮箱或用户名"
                ref={emailInputRef}
                size="large"
                prefix={
                  <Icon
                    icon={Mail}
                    style={{
                      marginInline: 6,
                    }}
                  />
                }
                style={{
                  padding: 6,
                }}
                suffix={
                  <Button
                    icon={ChevronRight}
                    loading={loading}
                    title="下一步"
                    variant="filled"
                    onClick={() => form.submit()}
                  />
                }
              />
            </Form.Item>
          </Form>
        )}
        {isSocialOnly && (
          <Alert
            showIcon
            type="info"
            description="此账户未设置密码，请使用第三方登录或魔法链接登录。"
          />
        )}
        <AuthAgreement />
      </Flexbox>
    </AuthCard>
  )
}
