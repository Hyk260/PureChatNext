'use client'

import { Button, Input, Text } from '@lobehub/ui'
import { Form, Modal } from 'antd'
import { useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import { changeEmail } from '@/libs/better-auth/auth-client'

import { SettingRow } from './SettingRow'

interface EmailSettingProps {
  email: string | null
}

interface ChangeEmailFormValues {
  newEmail: string
}

export function EmailSetting({ email }: EmailSettingProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<ChangeEmailFormValues>()

  const handleSubmit = async (values: ChangeEmailFormValues) => {
    setLoading(true)

    try {
      const { error } = await changeEmail({
        callbackURL: '/settings/profile',
        newEmail: values.newEmail.trim().toLowerCase(),
      })

      if (error) {
        message.error(error.message ?? '修改邮箱失败')
        return
      }

      message.success('验证邮件已发送到新邮箱，请查收并完成验证')
      setOpen(false)
      form.resetFields()
    } catch {
      message.error('修改邮箱失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SettingRow
        action={
          email ? (
            <Text
              onClick={() => setOpen(true)}
              style={{ cursor: 'pointer', fontSize: 13 }}
            >
              修改邮箱
            </Text>
          ) : null
        }
        label="邮箱"
      >
        <Text type={email ? undefined : 'secondary'}>{email || '未绑定邮箱'}</Text>
      </SettingRow>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setOpen(false)}
        open={open}
        title="修改邮箱"
      >
        <Text style={{ display: 'block', marginBottom: 16 }} type="secondary">
          验证邮件将发送到新邮箱地址，验证完成后邮箱才会更新。
        </Text>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="新邮箱"
            name="newEmail"
            rules={[
              { required: true, message: '请输入新邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="new@example.com" type="email" />
          </Form.Item>
          <Form.Item className="mb-0">
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button htmlType="submit" loading={loading} type="primary">
                确认
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
