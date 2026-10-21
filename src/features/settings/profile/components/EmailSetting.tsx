'use client'

import { toast } from '@lobehub/ui'
import { Form, useForm } from '@lobehub/ui/form'
import { Button, Input, Text, Modal, Flex } from '@pure/ui'
import { useState } from 'react'

import { changeEmail } from '@/libs/better-auth/client'

import { SettingRow } from './SettingRow'
import { changeEmailSchema } from '@/features/auth/authFormSchemas'

interface EmailSettingProps {
  email: string | null
}

interface ChangeEmailFormValues {
  newEmail: string
}

export function EmailSetting({ email }: EmailSettingProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const form = useForm<ChangeEmailFormValues>({
    initialValues: { newEmail: '' },
    schema: changeEmailSchema,
    onSubmit: (values) => handleSubmit(values),
  })

  const handleSubmit = async (values: ChangeEmailFormValues) => {
    setLoading(true)

    try {
      const { error } = await changeEmail({
        callbackURL: '/settings/profile',
        newEmail: values.newEmail.trim().toLowerCase(),
      })

      if (error) {
        toast.error(error.message ?? '修改邮箱失败')
        return
      }

      toast.success('验证邮件已发送到新邮箱，请查收并完成验证')
      setOpen(false)
      form.reset({ newEmail: '' })
    } catch {
      toast.error('修改邮箱失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SettingRow
        action={
          email ? (
            <Text className='cursor-pointer text-[13px]' onClick={() => setOpen(true)}>
              修改邮箱
            </Text>
          ) : null
        }
        label='邮箱'
      >
        <Text type={email ? undefined : 'secondary'}>{email || '未绑定邮箱'}</Text>
      </SettingRow>

      <Modal destroyOnHidden footer={null} onCancel={() => setOpen(false)} open={open} title='修改邮箱' width={420}>
        <Text className='mb-4 block' type='secondary'>
          验证邮件将发送到新邮箱地址，验证完成后邮箱才会更新。
        </Text>
        <Form form={form} layout='vertical'>
          <Form.Field label='新邮箱' name='newEmail' required>
            <Input placeholder='new@example.com' type='email' />
          </Form.Field>
          <Flex className='justify-end gap-2'>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button htmlType='submit' loading={loading} type='primary'>
              确认
            </Button>
          </Flex>
        </Form>
      </Modal>
    </>
  )
}
