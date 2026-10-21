'use client'

import { Flex, Input, Modal, Select, Text } from '@pure/ui'
import { Slider } from '@lobehub/ui'
import type { ModelAbilities } from '@pure/model-bank'
import { memo, useEffect, useMemo, useState } from 'react'

import type { ProviderModelItem } from '../../types'
import {
  CONTEXT_WINDOW_MARKS,
  CONTEXT_WINDOW_STEPS,
  MAX_CONTEXT_WINDOW,
  nearestContextWindowStepIndex,
} from './contextWindowSlider'

const clampContextWindowTokens = (raw: number) =>
  Number.isFinite(raw) ? Math.min(MAX_CONTEXT_WINDOW, Math.max(0, Math.round(raw))) : 0

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
  // {
  //   description: '标记模型支持结构化 JSON 输出。',
  //   key: 'structuredOutput',
  //   label: '支持结构化输出',
  // },
]

type AbilityKey = (typeof ABILITY_OPTIONS)[number]['key']

const ABILITY_SELECT_OPTIONS = ABILITY_OPTIONS.map(({ description, key, label }) => ({
  label,
  value: key,
  description,
}))

const CONTEXT_WINDOW_MARK_ENTRIES = Object.entries(CONTEXT_WINDOW_MARKS).map(([index, label]) => ({
  index: Number(index),
  label,
}))

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

  const selectedAbilityKeys = useMemo(
    () => ABILITY_OPTIONS.filter(({ key }) => Boolean(abilities[key])).map(({ key }) => key),
    [abilities]
  )

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
      <Flex className='w-full flex-col gap-5 py-2'>
        <Flex className='w-full flex-col gap-1.5'>
          <Text className='text-sm font-medium'>
            <span className='mr-1 text-red-500'>*</span>模型 ID
          </Text>
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
        </Flex>

        <Flex className='w-full flex-col gap-1.5'>
          <Text className='text-sm font-medium'>模型展示名称</Text>
          <Input
            placeholder='请输入模型展示名称，例如 DeepSeek Chat、DeepSeek Reasoner 等'
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Text type='secondary'>留空时使用模型 ID 作为展示名称。</Text>
        </Flex>

        <Flex className='w-full flex-col gap-1.5'>
          <Text className='text-sm font-medium'>最大上下文窗口</Text>
          <Flex className='items-start gap-4'>
            <div className='relative min-w-0 flex-1 pb-6'>
              <Slider
                className='min-w-0'
                max={CONTEXT_WINDOW_STEPS.length - 1}
                min={0}
                step={1}
                value={nearestContextWindowStepIndex(contextWindowTokens)}
                onChange={(index) => setContextWindowTokens(CONTEXT_WINDOW_STEPS[index] ?? 0)}
              />
              <div className='pointer-events-none absolute inset-x-0 bottom-0 h-5 text-xs text-muted-foreground'>
                {CONTEXT_WINDOW_MARK_ENTRIES.map(({ index, label }) => {
                  const isFirst = index === 0
                  const isLast = index === CONTEXT_WINDOW_STEPS.length - 1
                  const position = (index / (CONTEXT_WINDOW_STEPS.length - 1)) * 100
                  return (
                    <span
                      className='absolute whitespace-nowrap'
                      key={index}
                      style={{
                        left: `${position}%`,
                        transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                      }}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            </div>
            <Flex className='shrink-0 items-center gap-2 pt-0.5'>
              <Input
                className='w-28'
                max={MAX_CONTEXT_WINDOW}
                min={0}
                type='number'
                value={contextWindowTokens}
                onChange={(event) => setContextWindowTokens(clampContextWindowTokens(Number(event.target.value)))}
              />
            </Flex>
          </Flex>
          <Text type='secondary'>设置模型支持的最大 Token 数，设为 0 表示不指定。</Text>
        </Flex>

        <Flex className='w-full flex-col gap-1.5'>
          <Text className='text-sm font-medium'>模型能力</Text>
          <Select
            className='w-full'
            mode='multiple'
            options={ABILITY_SELECT_OPTIONS}
            placeholder='请选择模型能力'
            value={selectedAbilityKeys}
            optionRender={(option) => {
              const ability = ABILITY_SELECT_OPTIONS.find(({ value }) => value === option.value)
              return (
                <Flex className='flex-col gap-1 py-1'>
                  <span>{option.label}</span>
                  {ability ? <Text type='secondary'>{ability.description}</Text> : null}
                </Flex>
              )
            }}
            onChange={(value) => {
              const nextKeys = Array.isArray(value) ? value : value ? [value] : []
              const selectedKeys = new Set(nextKeys)
              setAbilities((current) => {
                const nextAbilities = { ...current }
                for (const { key } of ABILITY_OPTIONS) nextAbilities[key] = selectedKeys.has(key)
                return nextAbilities
              })
            }}
          />
          <Text type='secondary'>可多选，用于标记模型支持的能力。</Text>
        </Flex>
      </Flex>
    </Modal>
  )
})

CustomModelModal.displayName = 'CustomModelModal'

export default CustomModelModal
