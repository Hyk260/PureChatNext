'use client'

import { getErrorMessage } from '@pure/utils/error'

import { BRANDING_NAME } from '@/const/branding'
import AuthAgreement, { withAuthAgreement } from '@/features/AuthAgreement'
import { AuthCard } from '@/features/AuthCard'
import { Button, Flex, Icon, Input, InputPassword, Text } from '@pure/ui'
import { Form, useForm } from '@lobehub/ui/form'
import { Gift, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getReferralContext } from '@/libs/referrals/helpers'
import { referralRequest } from '@/features/referrals/api'
import { signUpSchema } from '../authFormSchemas'

import { useSignUp } from './useSignUp'
import type { SignUpFormValues } from './useSignUp'

// configReady 由 SignUpPage 在外层保证，此处直接渲染表单内容
export const SignUpForm = () => {
  const params = useSearchParams()
  return <SignUpFormContent key={getReferralContext(params)} />
}

const SignUpFormContent = () => {
  const { loading, referralError, onSubmit } = useSignUp()
  const form = useForm<SignUpFormValues>({
    initialValues: { email: '', password: '', confirmPassword: '', referralCode: '' },
    schema: signUpSchema,
    onSubmit: (values) => withAuthAgreement(() => onSubmit(values)),
  })
  const searchParams = useSearchParams()
  const referralContext = getReferralContext(searchParams)
  const [invitationReady, setInvitationReady] = useState(!referralContext)
  const [invitationError, setInvitationError] = useState('')

  useEffect(() => {
    if (referralError) form.setErrors({ referralCode: referralError })
  }, [referralError, form])

  useEffect(() => {
    if (!referralContext) {
      form.setValue('referralCode', searchParams.get('referral') ?? '')
      return
    }
    let cancelled = false
    referralRequest<{ email: string; referralCode: string }>('/prepare', { context: referralContext })
      .then((result) => {
        if (cancelled) return
        form.setValue('referralCode', result.referralCode)
        form.setValue('email', result.email)
        setInvitationReady(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) setInvitationError(getErrorMessage(error, '邀请信息加载失败'))
      })
    return () => {
      cancelled = true
    }
  }, [referralContext, searchParams, form])

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

        <Form.Field name='referralCode' className='gap-0'>
          <Input
            aria-label='邀请码（可选）'
            placeholder='邀请码（可选）'
            prefix={<Icon icon={Gift} />}
            readOnly={Boolean(referralContext)}
            autoComplete='off'
            size='large'
          />
        </Form.Field>
        {referralContext ? (
          <Text type='secondary' fontSize={12}>
            邮件邀请已绑定邀请人，不可修改。
          </Text>
        ) : null}
        {invitationError ? (
          <Text role='alert' type='danger'>
            {invitationError}
          </Text>
        ) : null}

        <Flex className='flex-col gap-4 py-1'>
          <AuthAgreement />
          <Button block htmlType='submit' loading={loading} disabled={!invitationReady} size='large' type='primary'>
            注册
          </Button>
        </Flex>
      </Form>
    </AuthCard>
  )
}
