'use client'

import { BRANDING_NAME } from '@/const/branding'
import AuthAgreement, { withAuthAgreement } from '@/features/AuthAgreement'
import { AuthCard } from '@/features/AuthCard'
import { Button, Flex, Icon, Input, InputPassword, Text } from '@pure/ui'
import { Form, useForm } from '@lobehub/ui/form'
import { Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { signUpSchema } from '../authFormSchemas'

import { useSignUp } from './useSignUp'
import type { SignUpFormValues } from './useSignUp'

// configReady 由 SignUpPage 在外层保证，此处直接渲染表单内容
export const SignUpForm = () => {
  return <SignUpFormContent />
}

const SignUpFormContent = () => {
  const { loading, onSubmit } = useSignUp()
  const form = useForm<SignUpFormValues>({
    initialValues: { email: '', password: '', confirmPassword: '' },
    schema: signUpSchema,
    onSubmit: (values) => withAuthAgreement(() => onSubmit(values)),
  })
  const searchParams = useSearchParams()

  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const email = searchParams.get('email')
    if (email) {
      form.setValue('email', email)
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
      <Form form={form} layout='vertical'>
        <Form.Field name='email' className='gap-0'>
          <Input placeholder='请输入邮箱地址' prefix={<Icon icon={Mail} />} ref={emailInputRef} size='large' />
        </Form.Field>

        <Form.Field name='password' className='gap-0'>
          <InputPassword
            placeholder='请输入密码'
            prefix={<Icon icon={Lock} />}
            ref={passwordInputRef}
            size='large'
          />
        </Form.Field>

        <Form.Field deps={['password']} name='confirmPassword' className='gap-0'>
          <InputPassword placeholder='请确认密码' prefix={<Icon icon={Lock} />} size='large' />
        </Form.Field>

        <Flex className='flex-col gap-4 py-1'>
          <AuthAgreement />
          <Button block htmlType='submit' loading={loading} size='large' type='primary'>
            注册
          </Button>
        </Flex>
      </Form>
    </AuthCard>
  )
}
