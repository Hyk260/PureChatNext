'use client'

import { Button, Form, Input } from 'antd'
import Link from 'next/link'

import { useResetPassword, type ResetPasswordFormValues } from './useResetPassword'

export const ResetPasswordForm = () => {
  const [form] = Form.useForm<ResetPasswordFormValues>()
  const { email, handleResetPassword, loading, token } = useResetPassword()

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          重置链接无效或已过期。请返回登录页重新申请密码重置邮件。
        </p>
        <Link href={email ? `/signin?email=${encodeURIComponent(email)}` : '/signin'}>
          <Button block type="primary">
            返回登录
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleResetPassword}>
      {email ? (
        <p className="mb-4 text-sm text-muted-foreground">
          正在为 <span className="font-medium text-foreground">{email}</span> 设置新密码
        </p>
      ) : null}

      <Form.Item
        label="新密码"
        name="password"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 8, message: '密码至少 8 个字符' },
          { max: 64, message: '密码最多 64 个字符' },
        ]}
      >
        <Input.Password placeholder="请输入新密码" />
      </Form.Item>

      <Form.Item
        dependencies={['password']}
        label="确认密码"
        name="confirmPassword"
        rules={[
          { required: true, message: '请确认密码' },
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
        <Input.Password placeholder="请再次输入新密码" />
      </Form.Item>

      <Form.Item>
        <Button block htmlType="submit" loading={loading} type="primary">
          重置密码
        </Button>
      </Form.Item>
    </Form>
  )
}
