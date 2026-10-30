'use client'

import { Button, Checkbox, Input, Modal, Popover, Text, TextArea } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { Form, useForm, useWatch } from '@lobehub/ui/form'
import type { FormInstance } from '@lobehub/ui/form'
import { Bell, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { TaskChannel, TaskChannelAvailability, TaskDTO, TaskInput } from '@pure/types'
import { DEFAULT_TASK_SCHEDULE } from '@pure/utils/taskSchedule'
import { getErrorMessage } from '@pure/utils/error'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import { PURE_AI_AGENT_ID } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import { DEFAULT_HOME_MODEL } from '@/const/home/models'
import ModelSwitchMenu from '@/features/chat/ModelSwitchMenu'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { taskInputSchema } from '@/libs/tasks/schema'
import { TASK_CHANNEL_LABELS } from './presentation'
import { TaskAssigneePicker } from './TaskAssigneePicker'
import { TaskPriorityMenu } from './TaskMenus'
import { TaskSchedulePicker } from './TaskSchedulePicker'

function editorValues(task: TaskDTO | undefined, provider: string, model: string): TaskInput {
  if (task)
    return {
      agentId: task.agentId,
      channels: task.channels,
      enabled: task.enabled,
      instruction: task.instruction,
      model: task.model,
      priority: task.priority,
      provider: task.provider,
      schedule: task.schedule,
      title: task.title,
    }
  return {
    agentId: PURE_AI_AGENT_ID,
    channels: [],
    enabled: true,
    instruction: '',
    model,
    priority: 0,
    provider,
    schedule: DEFAULT_TASK_SCHEDULE,
    title: '',
  }
}

function TaskModelPicker({ form }: { form: FormInstance<TaskInput> }) {
  const provider = useWatch(form, 'provider')
  const model = useWatch(form, 'model')
  const label = getAiModel(provider as ModelProviderId, model)?.displayName ?? model
  return (
    <ModelSwitchMenu
      selectedModel={model}
      selectedProvider={provider}
      includeCustomProviders
      excludeLocalProviders
      openOnHover={false}
      placement='bottomLeft'
      onSelect={(nextProvider, nextModel) =>
        form.setValues({ provider: nextProvider, model: nextModel }, { asUser: true })
      }
    >
      <Button type='text' size='small' title={`${provider} / ${model}`}>
        <Text as='span' className='max-w-36 truncate'>
          {label}
        </Text>
        <ChevronDown size={13} />
      </Button>
    </ModelSwitchMenu>
  )
}

const CHANNELS: TaskChannel[] = ['qq', 'wechat']

function TaskChannelsPicker({
  value,
  onChange,
  availability,
}: {
  value: TaskChannel[]
  onChange: (value: TaskChannel[]) => void
  availability: TaskChannelAvailability[]
}) {
  const content = (
    <div className='w-80 space-y-4 p-4'>
      <Text as='h3' className='m-0 text-base font-semibold'>
        推送到本人消息渠道
      </Text>
      <Text as='p' className='m-0 text-xs text-muted-foreground'>
        成功结果或最终失败摘要及详情链接；只能选择当前可用的渠道。
      </Text>
      {CHANNELS.map((platform) => {
        const channel = availability.find((item) => item.platform === platform)
        const checked = value.includes(platform)
        return (
          <div key={platform} className='space-y-1.5'>
            <Checkbox
              checked={checked}
              disabled={!channel?.available && !checked}
              onChange={(next) => {
                onChange(next ? [...value, platform] : value.filter((item) => item !== platform))
              }}
            >
              {TASK_CHANNEL_LABELS[platform]}
            </Checkbox>
            {!channel?.available && (
              <Text as='p' className='m-0 text-xs text-muted-foreground'>
                {channel?.reason ?? '正在检查渠道配置'}{' '}
                <Link className='underline' to={`/settings/messenger/${platform}`}>
                  前往设置
                </Link>
                {platform === 'qq' && '（请在高级设置中填写本人 user_openid）'}
              </Text>
            )}
          </div>
        )
      })}
      <Text as='p' className='m-0 text-xs text-muted-foreground'>
        QQ 使用 C2C 主动消息，不受被动回复窗口限制；微信需要本人会话凭据。
      </Text>
    </div>
  )
  const label = value.length ? value.map((platform) => TASK_CHANNEL_LABELS[platform]).join('、') : '消息推送'
  return (
    <Popover content={content} trigger='click' placement='bottomLeft'>
      <Button type='text' size='small'>
        <Bell size={15} />
        {label}
      </Button>
    </Popover>
  )
}

type TaskEditorProps = {
  agents: AgentListItem[]
  availability: TaskChannelAvailability[]
  onClose: () => void
  onSave: (input: TaskInput) => Promise<void>
  task?: TaskDTO
}

export function TaskEditor({ agents, availability, onClose, onSave, task }: TaskEditorProps) {
  const provider = useHomeStore((state) => state.selectedProvider)
  const model = useHomeStore((state) => state.selectedModel)
  const isLocalDefault = provider === 'lmstudio'
  const initialProvider = isLocalDefault ? DEFAULT_HOME_MODEL.provider : provider
  const initialModel = isLocalDefault ? DEFAULT_HOME_MODEL.model : model
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<TaskInput>({
    initialValues: editorValues(task, initialProvider, initialModel),
    schema: taskInputSchema,
    onSubmit: async (values) => {
      if (saving) return
      setSaving(true)
      setError(null)
      try {
        await onSave(values)
        onClose()
      } catch (cause) {
        setError(getErrorMessage(cause, '保存任务失败'))
      } finally {
        setSaving(false)
      }
    },
  })
  const submit = async () => {
    const result = await form.submit()
    if (!result.valid) setError(Object.values(result.errors).find(Boolean) ?? '请检查任务配置')
  }
  return (
    <Modal
      open
      title={task ? '编辑任务' : '新建定时任务'}
      footer={null}
      centered
      width='min(980px, calc(100vw - 48px))'
      onCancel={onClose}
      maskClosable={!saving}
      keyboard={!saving}
      classNames={{ body: 'p-0' }}
    >
      <Form
        form={form}
        layout='vertical'
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
      >
        <div className='min-h-[400px] px-6 pb-4 pt-7 sm:px-8'>
          <Form.Field name='title'>
            <Input
              aria-label='任务标题'
              autoFocus
              placeholder='任务标题'
              variant='borderless'
              classNames={{ input: 'text-3xl font-semibold' }}
              maxLength={200}
              disabled={saving}
            />
          </Form.Field>
          <Form.Field name='instruction'>
            <TextArea
              aria-label='执行说明'
              placeholder='添加执行说明，例如：整理今日科技新闻，附上来源链接…'
              variant='borderless'
              autoSize={{ minRows: 10, maxRows: 18 }}
              maxLength={20_000}
              disabled={saving}
            />
          </Form.Field>
          {error && (
            <Text as='p' role='alert' type='danger' className='px-2 text-sm'>
              {error}
            </Text>
          )}
        </div>
        <div className='border-t border-border px-2 py-4 sm:px-6'>
          <Flex className='flex-col gap-3 sm:flex-row sm:items-center'>
            <Flex className='min-w-0 flex-1 flex-wrap items-center gap-1'>
              <Form.Field
                name='schedule'
                bare
                render={({ value, onChange }) => <TaskSchedulePicker value={value} onChange={onChange} />}
              />
              <Form.Field
                name='priority'
                bare
                render={({ value, onChange }) => (
                  <TaskPriorityMenu value={value} onChange={onChange} disabled={saving} />
                )}
              />
              <Form.Field
                name='agentId'
                bare
                render={({ value, onChange }) => (
                  <TaskAssigneePicker
                    agents={agents}
                    value={value}
                    disabled={saving}
                    onChange={(agentId) => {
                      onChange(agentId)
                      const agent = agents.find((item) => item.id === agentId)
                      if (agent?.provider && agent.model)
                        form.setValues({ provider: agent.provider, model: agent.model }, { asUser: true })
                    }}
                  />
                )}
              />
              <TaskModelPicker form={form} />
              <Form.Field
                name='channels'
                bare
                render={({ value, onChange }) => (
                  <TaskChannelsPicker value={value} onChange={onChange} availability={availability} />
                )}
              />
            </Flex>
            <Flex className='flex-between shrink-0 gap-3'>
              <Button type='primary' shape='round' loading={saving} onClick={submit}>
                {task ? '保存修改' : '创建任务'}
              </Button>
            </Flex>
          </Flex>
        </div>
      </Form>
    </Modal>
  )
}
