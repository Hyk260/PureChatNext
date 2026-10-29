'use client'

import { getErrorMessage } from '@pure/utils/error'

import { toast } from '@lobehub/ui'
import { Avatar, Input, Text, TextArea, Modal, Flex, Button } from '@pure/ui'
import { lazy, memo, Suspense, useEffect, useState } from 'react'

import type { AgentListItem } from '@/const/home/agents'
import { generateAgentProfile } from '@/features/home/agentApi'
import { padOpeningQuestions, profileFormValues } from './agentFormValues'
import type { AgentFormValues } from './agentFormValues'

export type { AgentFormValues }

const EmojiPicker = lazy(() => import('@pure/ui/EmojiPicker'))

interface AgentFormModalProps {
  agent?: AgentListItem | null
  confirmLoading?: boolean
  onCancel: () => void
  onSubmit: (values: AgentFormValues) => void | Promise<void>
  open: boolean
}

const emptyValues = profileFormValues()

const AgentFormModal = memo<AgentFormModalProps>(({ agent, confirmLoading, onCancel, onSubmit, open }) => {
  const [values, setValues] = useState<AgentFormValues>(emptyValues)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const isEdit = Boolean(agent)
  const isCommunity = Boolean(agent?.marketIdentifier)
  const editTitle = isEdit ? '编辑助理' : '新建助理'
  const editOkText = isEdit ? '保存' : '创建'
  const modalTitle = isCommunity ? '另存为自定义助理' : editTitle
  const okText = isCommunity ? '另存' : editOkText
  const canGenerate = values.description.trim().length > 0

  const handleUpload = (file: File) => {
    setUploading(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploading(false)
      if (typeof reader.result !== 'string' || !reader.result) return
      const avatar = reader.result
      setValues((prev) => ({ ...prev, avatar }))
    }
    reader.onerror = () => setUploading(false)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!open) return
    setUploading(false)
    setGenerating(false)
    if (agent) {
      setValues(profileFormValues(agent))
    } else {
      setValues(emptyValues)
    }
  }, [agent, open])

  const handleGenerate = async () => {
    if (!canGenerate || generating) return
    setGenerating(true)
    try {
      const profile = await generateAgentProfile({
        description: values.description.trim(),
        systemRole: values.systemRole.trim() || undefined,
        title: values.title.trim() || undefined,
      })
      setValues((prev) => ({
        ...prev,
        openingMessage: profile.openingMessage,
        openingQuestions: padOpeningQuestions(profile.openingQuestions),
      }))
      toast.success('已生成开场内容')
    } catch (error) {
      toast.error(getErrorMessage(error, '生成失败'))
    } finally {
      setGenerating(false)
    }
  }

  const handleQuestionChange = (index: number, value: string) => {
    setValues((prev) => {
      const openingQuestions = [...prev.openingQuestions]
      openingQuestions[index] = value
      return { ...prev, openingQuestions }
    })
  }

  const handleLoadSavedConfig = () => {
    if (agent?.savedConfig) setValues(profileFormValues(agent.savedConfig))
  }

  const handleOk = async () => {
    const title = values.title.trim()
    if (!title) return
    await onSubmit({
      avatar: values.avatar.trim() || '🤖',
      backgroundColor: values.backgroundColor,
      description: values.description.trim(),
      openingMessage: values.openingMessage.trim(),
      openingQuestions: values.openingQuestions.map((question) => question.trim()).filter(Boolean),
      systemRole: values.systemRole.trim(),
      title,
    })
  }

  return (
    <Modal
      confirmLoading={confirmLoading}
      destroyOnHidden
      okText={okText}
      open={open}
      cancelText='取消'
      title={modalTitle}
      width={480}
      onCancel={onCancel}
      onOk={handleOk}
    >
      <Flex className='max-h-[60vh] flex-col gap-3 overflow-y-auto py-2'>
        {isCommunity ? (
          <Flex className='flex-col gap-2'>
            <Text as='p' className='m-0 text-sm text-muted-foreground'>
              {agent?.configSource === 'snapshot'
                ? '社区来源已不可用，当前使用原有配置。保存后会创建独立的自定义助理。'
                : '社区助理自动跟随最新配置。保存后会创建独立的自定义助理。'}
            </Text>
            {agent?.savedConfig ? (
              <Button size='small' onClick={handleLoadSavedConfig}>
                载入原有配置
              </Button>
            ) : null}
          </Flex>
        ) : null}
        <Flex className='flex-col gap-1'>
          <Text className='text-[12px]' type='secondary'>
            头像
          </Text>
          <Suspense fallback={<Avatar avatar={values.avatar} loading shape='square' size={48} />}>
            <EmojiPicker
              allowUpload
              allowDelete={Boolean(values.avatar)}
              defaultAvatar='🤖'
              locale='zh-CN'
              loading={uploading}
              shape='square'
              size={48}
              value={values.avatar}
              onChange={(emoji) => setValues((prev) => ({ ...prev, avatar: emoji || '🤖' }))}
              onDelete={() => setValues((prev) => ({ ...prev, avatar: '🤖' }))}
              onUpload={handleUpload}
            />
          </Suspense>
        </Flex>
        <Flex className='flex-col gap-1'>
          <Text className='text-[12px]' type='secondary'>
            名称
          </Text>
          <Input
            placeholder='助理名称'
            value={values.title}
            onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          />
        </Flex>
        <Flex className='flex-col gap-1'>
          <Text className='text-[12px]' type='secondary'>
            描述
          </Text>
          <Input
            placeholder='简短描述'
            value={values.description}
            onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
          />
        </Flex>
        <Flex className='flex-col gap-1'>
          <Text className='text-[12px]' type='secondary'>
            系统提示词
          </Text>
          <TextArea
            placeholder='系统提示词'
            rows={6}
            value={values.systemRole}
            onChange={(event) => setValues((prev) => ({ ...prev, systemRole: event.target.value }))}
          />
        </Flex>
        <Flex className='flex-col gap-1'>
          <Flex className='flex-between items-center'>
            <Text className='text-[12px]' type='secondary'>
              开场消息
            </Text>
            <Button disabled={!canGenerate} loading={generating} size='small' onClick={handleGenerate}>
              根据描述生成
            </Button>
          </Flex>
          <TextArea
            placeholder='进入对话时的欢迎语'
            rows={3}
            value={values.openingMessage}
            onChange={(event) => setValues((prev) => ({ ...prev, openingMessage: event.target.value }))}
          />
        </Flex>
        <Flex className='flex-col gap-1'>
          <Text className='text-[12px]' type='secondary'>
            开场问题
          </Text>
          {values.openingQuestions.map((question, index) => (
            <Input
              key={index}
              placeholder={`问题 ${index + 1}`}
              value={question}
              onChange={(event) => handleQuestionChange(index, event.target.value)}
            />
          ))}
        </Flex>
      </Flex>
    </Modal>
  )
})

AgentFormModal.displayName = 'AgentFormModal'

export default AgentFormModal
