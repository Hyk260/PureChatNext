'use client'

import { Block, Button, Icon, InputPassword, Text } from '@pure/ui'
import { Form, useForm } from '@lobehub/ui/form'
import { Lock } from 'lucide-react'

import { useResetPassword } from './useResetPassword'
import type { ResetPasswordFormValues } from './useResetPassword'
import { resetPasswordSchema } from '../authFormSchemas'

export const ResetPasswordForm = () => {
  const { handleResetPassword, loading, token } = useResetPassword()
  const form = useForm<ResetPasswordFormValues>({ schema: resetPasswordSchema, onSubmit: handleResetPassword })

  if (!token) {
    return (
      <Block padding={24}>
        <Text className='text-center text-[16px]'>重置链接无效或已过期。请返回登录页重新申请密码重置邮件。</Text>
      </Block>
    )
  }

  return (
    <Form form={form} layout='vertical'>
      <Form.Field name='password'>
        <InputPassword
          placeholder='请输入新密码'
          size='large'
          prefix={<Icon icon={Lock} style={{ marginInline: 6 }} />}
        />
      </Form.Field>

      <Form.Field deps={['password']} name='confirmPassword'>
        <InputPassword
          placeholder='请再次输入新密码'
          size='large'
          prefix={<Icon icon={Lock} style={{ marginInline: 6 }} />}
        />
      </Form.Field>

      <Button block htmlType='submit' loading={loading} size='large' type='primary'>
        重置密码
      </Button>
    </Form>
  )
}
