'use client'

import { Flex, Typography, Input, Modal } from 'antd'
import { memo, useEffect, useState } from 'react'

import { type AgentListItem } from '@/const/home/agents'

export type AgentFormValues = {
  avatar: string
  description: string
  systemRole: string
  title: string
}

interface AgentFormModalProps {
  agent?: AgentListItem | null
  confirmLoading?: boolean
  onCancel: () => void
  onSubmit: (values: AgentFormValues) => void | Promise<void>
  open: boolean
}

const emptyValues: AgentFormValues = {
  avatar: '🤖',
  description: '',
  systemRole: '',
  title: '',
}

const AgentFormModal = memo<AgentFormModalProps>(
  ({ agent, confirmLoading, onCancel, onSubmit, open }) => {
    const [values, setValues] = useState<AgentFormValues>(emptyValues)
    const isEdit = Boolean(agent)

    useEffect(() => {
      if (!open) return
      if (agent) {
        setValues({
          avatar: agent.avatar || '🤖',
          description: agent.description ?? '',
          systemRole: agent.systemRole ?? '',
          title: agent.title,
        })
      } else {
        setValues(emptyValues)
      }
    }, [agent, open])

    const handleOk = async () => {
      const title = values.title.trim()
      if (!title) return
      await onSubmit({
        avatar: values.avatar.trim() || '🤖',
        description: values.description.trim(),
        systemRole: values.systemRole.trim(),
        title,
      })
    }

    return (
      <Modal
        confirmLoading={confirmLoading}
        centered
        destroyOnHidden
        okText={isEdit ? '保存' : '创建'}
        open={open}
        cancelText='取消'
        cl
        title={isEdit ? '编辑助理' : '新建助理'}
        width={480}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Flex vertical gap={12} style={{ paddingBlock: 8 }}>
          <Flex vertical gap={4}>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              名称
            </Typography.Text>
            <Input
              placeholder='助理名称'
              value={values.title}
              onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
            />
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              头像（emoji 或 URL）
            </Typography.Text>
            <Input
              placeholder='✨'
              value={values.avatar}
              onChange={(event) => setValues((prev) => ({ ...prev, avatar: event.target.value }))}
            />
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              描述
            </Typography.Text>
            <Input
              placeholder='简短描述'
              value={values.description}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              系统提示词
            </Typography.Text>
            <Input.TextArea
              placeholder='系统提示词'
              rows={6}
              value={values.systemRole}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, systemRole: event.target.value }))
              }
            />
          </Flex>
        </Flex>
      </Modal>
    )
  },
)

AgentFormModal.displayName = 'AgentFormModal'

export default AgentFormModal
