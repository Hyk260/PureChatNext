'use client'

import { Block, Icon } from '@pure/ui'
import { Typography, Button, Form, Input } from 'antd'
import { Lock } from 'lucide-react'

import { useResetPassword, type ResetPasswordFormValues } from './useResetPassword'

export const ResetPasswordForm = () => {
  const [form] = Form.useForm<ResetPasswordFormValues>()
  const { handleResetPassword, loading, token } = useResetPassword()

  if (!token) {
    return (
      <Block padding={24}>
        <Typography.Text style={{ textAlign: 'center', fontSize: 16 }}>
          重置链接无效或已过期。请返回登录页重新申请密码重置邮件。
        </Typography.Text>
      </Block>
    )
  }

  const passwordRules = [
    { message: '请输入新密码', required: true },
    { message: '密码至少 8 个字符', min: 8 },
    { message: '密码最多 64 个字符', max: 64 },
  ]

  const confirmPasswordRules = [
    { message: '请确认密码', required: true },
    ({ getFieldValue }: { getFieldValue: (name: string) => string }) => ({
      validator(_: unknown, value: string) {
        if (!value || getFieldValue('password') === value) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('两次输入的密码不一致'))
      },
    }),
  ]

  return (
    <Form form={form} layout='vertical' onFinish={handleResetPassword}>
      <Form.Item name='password' rules={passwordRules}>
        <Input.Password
          placeholder='请输入新密码'
          size='large'
          prefix={<Icon icon={Lock} style={{ marginInline: 6 }} />}
        />
      </Form.Item>

      <Form.Item dependencies={['password']} name='confirmPassword' rules={confirmPasswordRules}>
        <Input.Password
          placeholder='请再次输入新密码'
          size='large'
          prefix={<Icon icon={Lock} style={{ marginInline: 6 }} />}
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button block htmlType='submit' loading={loading} size='large' type='primary'>
          重置密码
        </Button>
      </Form.Item>
    </Form>
  )
}
