'use client'

import { Checkbox, Input, Modal, Text } from '@pure/ui'
import { Slider } from 'antd'
import type { ModelAbilities } from '@pure/model-bank'
import { memo, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { ProviderModelItem } from '../../types'

const MAX_CONTEXT_WINDOW = 2_000_000

const CONTEXT_WINDOW_MARKS: Record<number, ReactNode> = {
  0: '0',
  4_096: '4K',
  8_192: '8K',
  16_384: '16K',
  32_768: '32K',
  65_536: '64K',
  200_000: '200K',
  1_000_000: '1M',
  2_000_000: '2M',
}

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

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: !normalizedModelId || duplicate }}
      okText='确认'
      open={open}
      title={model ? '编辑自定义 AI 模型' : '创建自定义 AI 模型'}
      width={720}
      onCancel={onCancel}
      onOk={handleSubmit}
    >
      <div className='grid gap-x-6 gap-y-6 py-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-start'>
        <div className='pt-2 text-sm font-medium'>
          <span className='mr-1 text-red-500'>*</span>模型 ID
        </div>
        <div className='flex flex-col gap-1'>
          <Input
            autoFocus={!model}
            disabled={Boolean(model)}
            placeholder='请输入模型 ID，例如 gpt-4o 或 claude-3.5-sonnet'
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            onPressEnter={handleSubmit}
          />
          <Text type='secondary'>{model ? '模型 ID 创建后不可修改。' : '创建后模型 ID 将作为请求中的模型标识。'}</Text>
          {duplicate ? <Text type='danger'>该模型 ID 已存在</Text> : null}
        </div>

        <div className='pt-2 text-sm font-medium'>模型展示名称</div>
        <div className='flex flex-col gap-1'>
          <Input
            placeholder='请输入模型展示名称，例如 ChatGPT、GPT-4 等'
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Text type='secondary'>留空时使用模型 ID 作为展示名称。</Text>
        </div>

        <div className='pt-2 text-sm font-medium'>最大上下文窗口</div>
        <div className='flex min-w-0 flex-col gap-2'>
          <div className='flex items-center gap-4'>
            <Slider
              className='min-w-0 flex-1'
              marks={CONTEXT_WINDOW_MARKS}
              max={MAX_CONTEXT_WINDOW}
              min={0}
              step={1024}
              value={contextWindowTokens}
              onChange={(value) => setContextWindowTokens(Array.isArray(value) ? (value[0] ?? 0) : value)}
            />
            <Input
              className='w-24 shrink-0'
              max={MAX_CONTEXT_WINDOW}
              min={0}
              suffix='Tokens'
              type='number'
              value={contextWindowTokens}
              onChange={(event) => {
                const value = Number(event.target.value)
                setContextWindowTokens(Number.isFinite(value) ? Math.min(MAX_CONTEXT_WINDOW, Math.max(0, value)) : 0)
              }}
            />
          </div>
          <Text type='secondary'>设置模型支持的最大 Token 数，设为 0 表示不指定。</Text>
        </div>

        <div className='pt-2 text-sm font-medium'>模型能力</div>
        <div className='flex flex-col gap-4'>
          {ABILITY_OPTIONS.map(({ description, key, label }) => (
            <label className='flex items-start gap-3' key={key}>
              <Checkbox checked={Boolean(abilities[key])} onChange={(checked) => handleAbilityChange(key, checked)} />
              <span className='-mt-0.5 flex flex-col gap-1'>
                <span className='text-sm font-medium'>{label}</span>
                <Text type='secondary'>{description}</Text>
              </span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  )
})

CustomModelModal.displayName = 'CustomModelModal'

export default CustomModelModal
