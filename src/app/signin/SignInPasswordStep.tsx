'use client'

import { AuthCard } from '@/features/AuthCard'
import { SSO_PROVIDER_LABELS } from '@/libs/better-auth/constants'
import { Alert, Button, Icon, InputPassword, Text } from '@lobehub/ui'
import { Form } from 'antd'
import { cssVar } from 'antd-style'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import type { FormInstance, InputRef } from 'antd'

interface SignInFormValues {
  email: string
  password: string
}

interface SignInPasswordStepProps {
  email: string
  enableMagicLink?: boolean
  form: FormInstance<SignInFormValues>
  isSocialOnly?: boolean
  loading: boolean
  oAuthSSOProviders: readonly string[]
  onBack: () => void
  onForgotPassword: () => Promise<void>
  onSendMagicLink?: () => Promise<void>
  onSignIn: (values: Pick<SignInFormValues, 'password'>) => Promise<void>
}

export const SignInPasswordStep = ({
  email,
  enableMagicLink,
  form,
  isSocialOnly,
  loading,
  oAuthSSOProviders,
  onBack,
  onForgotPassword,
  onSendMagicLink,
  onSignIn,
}: SignInPasswordStepProps) => {
  const passwordInputRef = useRef<InputRef>(null)

  const providerHint = useMemo(() => {
    const labels = oAuthSSOProviders.map((p) => SSO_PROVIDER_LABELS[p] ?? p)
    return labels.length > 0 ? labels.join(' / ') : '第三方'
  }, [oAuthSSOProviders])

  useEffect(() => {
    if (!isSocialOnly) {
      passwordInputRef.current?.focus()
    }
  }, [isSocialOnly])

  if (isSocialOnly) {
    return (
      <AuthCard
        footer={
          <Button icon={ChevronLeft} size="large" style={{ marginTop: 12 }} onClick={onBack}>
            返回修改邮箱
          </Button>
        }
        subtitle="请输入密码以继续"
      >
        <Text fontSize={20}>{email}</Text>
        <Alert
          showIcon
          style={{ marginTop: 12 }}
          type="info"
          description={
            enableMagicLink
              ? `请返回上一步，或使用 ${providerHint} / 魔法链接登录。`
              : `请返回上一步，使用 ${providerHint} 登录。`
          }
          message="此账户未设置密码"
        />
        {enableMagicLink && onSendMagicLink && (
          <Button
            block
            loading={loading}
            size="large"
            style={{ marginTop: 12 }}
            type="primary"
            onClick={() => onSendMagicLink()}
          >
            发送登录链接
          </Button>
        )}
      </AuthCard>
    )
  }

  return (
    <AuthCard
      footer={
        <>
          <Text fontSize={13} type="secondary">
            <a
              style={{ color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={onForgotPassword}
            >
              忘记密码？
            </a>
          </Text>
          <Button icon={ChevronLeft} size="large" style={{ marginTop: 12 }} onClick={onBack}>
            返回修改邮箱
          </Button>
        </>
      }
      subtitle="请输入密码以继续"
    >
      <Text fontSize={20}>{email}</Text>
      <Form form={form} layout="vertical" onFinish={onSignIn}>
        <Form.Item
          name="password"
          rules={[{ message: '请输入密码', required: true }]}
          style={{ marginBottom: 0 }}
        >
          <InputPassword
            placeholder="请输入密码"
            ref={passwordInputRef}
            size="large"
            prefix={
              <Icon
                icon={Lock}
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
                style={{ color: cssVar.colorPrimary }}
                title="登录"
                variant="filled"
                onClick={() => form.submit()}
              />
            }
          />
        </Form.Item>
      </Form>
    </AuthCard>
  )
}
