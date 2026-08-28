'use client'

import { Checkbox, Input, Modal, Text } from '@pure/ui'
import { Slider } from 'antd'
import type { ModelAbilities } from '@pure/model-bank'
import { memo, useEffect, useMemo, useState } from 'react'

import type { ProviderModelItem } from '../../types'
import {
  CONTEXT_WINDOW_MARKS,
  CONTEXT_WINDOW_STEPS,
  MAX_CONTEXT_WINDOW,
  nearestContextWindowStepIndex,
} from './contextWindowSlider'

const ABILITY_OPTIONS: Array<{ description: string; key: keyof ModelAbilities; label: string }> = [
  {
    description: '允许模型使用工具或函数调用能力。',
    key: 'functionCall',
    label: '支持工具使用',
  },
  {
    description: '允许模型理解消息中的图片内容。',
    key: 'vision',
    label: '支持视觉识别',
  },
  {
    description: '标记模型支持深度思考或推理输出。',
    key: 'reasoning',
    label: '支持深度思考',
  },
  {
    description: '标记模型支持联网搜索能力。',
    key: 'webSearch',
    label: '支持联网搜索',
  },
  {
    description: '标记模型支持图片生成能力。',
    key: 'imageGeneration',
    label: '支持图片生成',
  },
  {
    description: '标记模型支持结构化 JSON 输出。',
    key: 'structuredOutput',
    label: '支持结构化输出',
  },
]

export interface CustomModelFormValues {
  abilities: ModelAbilities
  contextWindowTokens?: number
  displayName: string
  id: string
}

interface CustomModelModalProps {
  existingModelIds: string[]
  model?: ProviderModelItem
  onCancel: () => void
  onSave: (model: CustomModelFormValues) => void
  open: boolean
}

const CustomModelModal = memo<CustomModelModalProps>(({ existingModelIds, model, open, onCancel, onSave }) => {
  const [displayName, setDisplayName] = useState('')
  const [modelId, setModelId] = useState('')
  const [contextWindowTokens, setContextWindowTokens] = useState(0)
  const [abilities, setAbilities] = useState<ModelAbilities>({})
  const normalizedModelId = modelId.trim()
  const duplicate = useMemo(
    () => existingModelIds.some((id) => id.toLowerCase() === normalizedModelId.toLowerCase()),
    [existingModelIds, normalizedModelId]
  )

  useEffect(() => {
    if (!open) return
    setDisplayName(model?.displayName ?? '')
    setModelId(model?.id ?? '')
    setContextWindowTokens(model?.contextWindowTokens ?? 0)
    setAbilities(model?.abilities ?? {})
  }, [model, open])

  const handleAbilityChange = (key: keyof ModelAbilities, checked: boolean) => {
    setAbilities((current) => ({ ...current, [key]: checked }))
  }

  const handleSubmit = () => {
    if (!normalizedModelId || duplicate) return
    const configuredAbilities = Object.fromEntries(
      Object.entries(abilities).filter(([, enabled]) => enabled)
    ) as ModelAbilities

    onSave({
      abilities: configuredAbilities,
      contextWindowTokens: contextWindowTokens > 0 ? Math.round(contextWindowTokens) : undefined,
      displayName: displayName.trim() || normalizedModelId,
      id: normalizedModelId,
    })
  }

  const contextWindowMarks = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(CONTEXT_WINDOW_MARKS).map(([key, label]) => {
          const index = Number(key)
          const isFirst = index === 0
          const isLast = index === CONTEXT_WINDOW_STEPS.length - 1
          return [
            index,
            {
              label: <span className='inline-block whitespace-nowrap'>{label}</span>,
              style: {
                whiteSpace: 'nowrap' as const,
                ...(isFirst ? { transform: 'translateX(0)' } : {}),
                ...(isLast ? { transform: 'translateX(-100%)' } : {}),
              },
            },
          ]
        })
      ),
    []
  )

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: !normalizedModelId || duplicate }}
      okText='确认'
      cancelText='取消'
      open={open}
      title={model ? '编辑自定义 AI 模型' : '创建自定义 AI 模型'}
      width={720}
      onCancel={onCancel}
      onOk={handleSubmit}
    >
      <div className='grid gap-x-4 gap-y-4 py-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-start'>
        <div className='pt-2 text-right text-sm font-medium'>
          <span className='mr-1 text-red-500'>*</span>模型 ID
        </div>
        <div className='flex flex-col gap-1'>
          <Input
            autoFocus={!model}
            disabled={Boolean(model)}
            placeholder='请输入模型 ID，例如 deepseek-chat 或 deepseek-reasoner'
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            onPressEnter={handleSubmit}
          />
          <Text type='secondary'>{model ? '模型 ID 创建后不可修改。' : '创建后模型 ID 将作为请求中的模型标识。'}</Text>
          {duplicate ? <Text type='danger'>该模型 ID 已存在</Text> : null}
        </div>

        <div className='pt-2 text-right text-sm font-medium'>模型展示名称</div>
        <div className='flex flex-col gap-1'>
          <Input
            placeholder='请输入模型展示名称，例如 DeepSeek Chat、DeepSeek Reasoner 等'
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Text type='secondary'>留空时使用模型 ID 作为展示名称。</Text>
        </div>

        <div className='pt-2 text-right text-sm font-medium'>最大上下文窗口</div>
        <div className='flex min-w-0 flex-col gap-2'>
          <div className='flex items-start gap-4'>
            <Slider
              className='min-w-0 flex-1 pb-5'
              marks={contextWindowMarks}
              max={CONTEXT_WINDOW_STEPS.length - 1}
              min={0}
              step={1}
              tooltip={{ open: false }}
              value={nearestContextWindowStepIndex(contextWindowTokens)}
              onChange={(value) => {
                const index = Array.isArray(value) ? (value[0] ?? 0) : value
                setContextWindowTokens(CONTEXT_WINDOW_STEPS[index] ?? 0)
              }}
            />
            <div className='flex shrink-0 items-center gap-2 pt-0.5'>
              <Input
                className='w-28'
                max={MAX_CONTEXT_WINDOW}
                min={0}
                type='number'
                value={contextWindowTokens}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setContextWindowTokens(
                    Number.isFinite(value) ? Math.min(MAX_CONTEXT_WINDOW, Math.max(0, Math.round(value))) : 0
                  )
                }}
              />
            </div>
          </div>
          <Text type='secondary'>设置模型支持的最大 Token 数，设为 0 表示不指定。</Text>
        </div>

        <div className='pt-2 text-right text-sm font-medium'>模型能力</div>
        <div className='flex w-full flex-col gap-1'>
          {ABILITY_OPTIONS.map(({ description, key, label }) => {
            const checked = Boolean(abilities[key])
            const toggle = () => handleAbilityChange(key, !checked)

            return (
              <div
                aria-checked={checked}
                className='flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-(--ant-color-fill-quaternary)'
                key={key}
                role='checkbox'
                tabIndex={0}
                onClick={toggle}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  toggle()
                }}
              >
                {/* Custom Checkbox is not a native input, so label association cannot toggle it. */}
                <span
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox checked={checked} onChange={(next) => handleAbilityChange(key, next)} />
                </span>
                <span className='-mt-0.5 flex min-w-0 flex-1 flex-col gap-1'>
                  <span className='text-sm font-medium'>{label}</span>
                  <Text type='secondary'>{description}</Text>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
})

CustomModelModal.displayName = 'CustomModelModal'

export default CustomModelModal
