'use client'

import { ActionIcon, InputNumber, Slider, Switch, Text, TextArea } from '@lobehub/ui'
import type { ChatAdvancedSettings } from '@pure/types'
import { CircleHelp } from 'lucide-react'
import { memo, useId } from 'react'

import { hasInputPlaceholder, MAX_HISTORY_COUNT, MAX_INPUT_TEMPLATE_LENGTH } from '@/features/chat/advancedSettings'

type Props = {
  onChange: (patch: Partial<ChatAdvancedSettings>) => void
  value: ChatAdvancedSettings
}

const AdvancedSettingsContent = memo<Props>(({ value, onChange }) => {
  const id = useId()
  const templateError = Boolean(value.inputTemplate.trim()) && !hasInputPlaceholder(value.inputTemplate)

  return (
    <section aria-label='高级设置' className='flex min-h-0 flex-col gap-6 overflow-auto p-4'>
      {/* <Text as='h3' weight={500}>
        助手高级设置
      </Text> */}
      <div className='flex-between gap-3'>
        <div className='flex items-center gap-1'>
          <label htmlFor={`${id}-compression`}>自动压缩上下文</label>
          <ActionIcon
            aria-label='了解自动压缩上下文'
            icon={CircleHelp}
            size='small'
            title='上下文较长时，将较早消息总结为摘要，保留近期原文。原始记录不会删除。压缩使用当前模型，会产生 Token 用量。'
          />
        </div>
        <Switch
          checked={value.enableContextCompression}
          id={`${id}-compression`}
          size='small'
          onChange={(enableContextCompression) => onChange({ enableContextCompression })}
        />
      </div>
      <div className='flex flex-col gap-3'>
        <div className='flex-between gap-3'>
          <div className='flex items-center gap-1'>
            <label htmlFor={`${id}-history`}>限制历史消息</label>
            <ActionIcon
              aria-label='了解历史消息限制'
              icon={CircleHelp}
              size='small'
              title='只携带最近指定数量的历史消息，提问和回答各计一条。本次输入始终保留；工具链会保留必要的关联消息。范围外的信息也不会通过摘要带回。'
            />
          </div>
          <Switch
            checked={value.enableHistoryCount}
            id={`${id}-history`}
            size='small'
            onChange={(enableHistoryCount) => onChange({ enableHistoryCount })}
          />
        </div>
        {value.enableHistoryCount && (
          <div className='flex items-center gap-3'>
            <label className='sr-only' htmlFor={`${id}-history-count`} id={`${id}-history-count-label`}>
              历史消息数量
            </label>
            <Slider
              aria-labelledby={`${id}-history-count-label`}
              className='flex-1'
              max={Math.max(20, value.historyCount)}
              min={0}
              step={1}
              value={value.historyCount}
              onChange={(historyCount) => onChange({ historyCount })}
            />
            <InputNumber
              aria-label='历史消息数量输入'
              className='w-20 shrink-0'
              id={`${id}-history-count`}
              max={MAX_HISTORY_COUNT}
              min={0}
              precision={0}
              size='small'
              step={1}
              value={value.historyCount}
              onChange={(historyCount) => {
                if (historyCount !== null) onChange({ historyCount })
              }}
            />
          </div>
        )}
      </div>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-1'>
          <label htmlFor={`${id}-template`}>用户输入预处理</label>
          <ActionIcon
            aria-label='了解用户输入预处理'
            icon={CircleHelp}
            size='small'
            title='将当次用户输入填入 {{text}} 后发送给模型。仅处理本次输入，聊天记录保留原文；留空时不处理。'
          />
        </div>
        <TextArea
          aria-describedby={templateError ? `${id}-template-error` : undefined}
          aria-invalid={templateError}
          autoSize={{ minRows: 3, maxRows: 10 }}
          id={`${id}-template`}
          maxLength={MAX_INPUT_TEMPLATE_LENGTH}
          placeholder='预处理模板 {{text}} 将替换为本次输入内容'
          value={value.inputTemplate}
          onChange={(event) => onChange({ inputTemplate: event.target.value })}
        />
        {templateError && (
          <Text id={`${id}-template-error`} type='danger'>
            模板必须包含 {'{{text}}'}，以保留用户输入。
          </Text>
        )}
      </div>
    </section>
  )
})

AdvancedSettingsContent.displayName = 'AdvancedSettingsContent'

export default AdvancedSettingsContent
