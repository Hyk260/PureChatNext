'use client'

import { BRANDING_NAME } from '@/const/branding'
import AuthAgreement from '@/features/AuthAgreement'
import { AuthCard } from '@/features/AuthCard'
import { Button, Icon, Input, Text } from '@pure/ui'
import { Form } from 'antd'
import type { InputRef } from '@pure/ui'
import { Lock, Mail } from 'lucide-react'
import Link from '@/utils/link'
import { useSearchParams } from '@/utils/navigation'
import { useEffect, useRef } from 'react'

import { useSignUp } from './useSignUp'
import type { SignUpFormValues } from './useSignUp'

// configReady 由 SignUpPage 在外层保证，此处直接渲染表单内容
export const SignUpForm = () => {
  return <SignUpFormContent />
}

const SignUpFormContent = () => {
  const [form] = Form.useForm<SignUpFormValues>()
  const { loading, onSubmit } = useSignUp()
  const searchParams = useSearchParams()

  const emailInputRef = useRef<InputRef>(null)
  const passwordInputRef = useRef<InputRef>(null)

  useEffect(() => {
    const email = searchParams.get('email')
    if (email) {
      form.setFieldsValue({ email })
      passwordInputRef.current?.focus()
    } else {
      emailInputRef.current?.focus()
    }
  }, [searchParams, form])

  const signinHref = `/signin?${searchParams.toString()}`

  const footer = (
    <Text>
      已有账号？ <Link href={signinHref}>去登录</Link>
    </Text>
  )

  return (
    <AuthCard footer={footer} title={`创建 ${BRANDING_NAME} 账号`}>
      <Form form={form} layout='vertical' onFinish={onSubmit}>
        <Form.Item
          name='email'
          rules={[
            { message: '请输入邮箱', required: true },
            { message: '请输入有效的邮箱地址', type: 'email' },
          ]}
        >
          <Input
            placeholder='请输入邮箱地址'
            ref={emailInputRef}
            size='large'
            prefix={
              <Icon
                icon={Mail}
                style={{
                  marginInline: 6,
                }}
              />
            }
          />
        </Form.Item>

        <Form.Item
          name='password'
          rules={[
            { message: '请输入密码', required: true },
            { message: '密码至少 8 个字符', min: 8 },
            { max: 64, message: '密码最多 64 个字符' },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve()
                const hasLetter = /[a-z]/i.test(value)
                const hasNumber = /\d/.test(value)
                return hasLetter && hasNumber
                  ? Promise.resolve()
                  : Promise.reject(new Error('密码须同时包含字母和数字'))
              },
            },
          ]}
        >
          <Input.Password
            placeholder='请输入密码'
            ref={passwordInputRef}
            size='large'
            prefix={
              <Icon
                icon={Lock}
                style={{
                  marginInline: 6,
                }}
              />
            }
          />
        </Form.Item>

        <Form.Item
          dependencies={['password']}
          name='confirmPassword'
          rules={[
            { message: '请确认密码', required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            placeholder='请确认密码'
            size='large'
            prefix={
              <Icon
                icon={Lock}
                style={{
                  marginInline: 6,
                }}
              />
            }
          />
        </Form.Item>

        <Form.Item>
          <Button block htmlType='submit' loading={loading} size='large' type='primary'>
            注册
          </Button>
        </Form.Item>
      </Form>
      {/* <AuthAgreement /> */}
    </AuthCard>
  )
}
