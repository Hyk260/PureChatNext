'use client'

import { Flexbox, Input, Modal, Text, TextArea } from '@lobehub/ui'
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
        destroyOnHidden
        okText={isEdit ? '保存' : '创建'}
        open={open}
        title={isEdit ? '编辑助理' : '新建助理'}
        width={480}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Flexbox gap={12} paddingBlock={8}>
          <Flexbox gap={4}>
            <Text fontSize={12} type='secondary'>
              名称
            </Text>
            <Input
              placeholder='助理名称'
              value={values.title}
              onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <Text fontSize={12} type='secondary'>
              头像（emoji 或 URL）
            </Text>
            <Input
              placeholder='✨'
              value={values.avatar}
              onChange={(event) => setValues((prev) => ({ ...prev, avatar: event.target.value }))}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <Text fontSize={12} type='secondary'>
              描述
            </Text>
            <Input
              placeholder='简短描述'
              value={values.description}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </Flexbox>
          <Flexbox gap={4}>
            <Text fontSize={12} type='secondary'>
              系统提示词
            </Text>
            <TextArea
              placeholder='系统提示词'
              rows={6}
              value={values.systemRole}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, systemRole: event.target.value }))
              }
            />
          </Flexbox>
        </Flexbox>
      </Modal>
    )
  },
)

AgentFormModal.displayName = 'AgentFormModal'

export default AgentFormModal
