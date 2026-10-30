'use client'

import { getErrorMessage } from '@pure/utils/error'

import { RadioGroup, toast } from '@lobehub/ui'
import { Flex, Input, Modal, Select, Text } from '@pure/ui'
import { isBailianQwenSpeechModel, isQQSpeechReplyMode, speechVoiceOptions } from '@pure/const'
import { memo, useCallback, useMemo, useState } from 'react'
import type { QQSpeechModelReference } from '@pure/types'

import type { QQAdvancedSettings, QQSpeechModel } from './qqApi'
import { updateQQSpeechModel } from './qqApi'

type QQSpeechReplyMode = NonNullable<QQSpeechModelReference['replyMode']>

const SPEECH_REPLY_MODE_META: Record<QQSpeechReplyMode, { description: string; label: string }> = {
  smart: {
    description: '识别语音、朗读、唱歌，以及“想听你说话”等请求；不确定时发送文字。',
    label: '智能判断',
  },
  always: {
    description: '每条适合语音的回复优先尝试合成；失败且 QQ 回复仍可用时，自动回退为文字。',
    label: '一直使用语音',
  },
  never: {
    description: '始终只发送文字。',
    label: '否，只使用文字',
  },
}

type QQSpeechSettingsModalProps = {
  initialReplyMode: QQSpeechReplyMode
  initialInstruction: string
  initialVoice: string
  model: string
  open: boolean
  provider: string
  onClose: () => void
  onSaved: (settings: QQAdvancedSettings) => void
}

const QQSpeechSettingsModal = memo<QQSpeechSettingsModalProps>(
  ({ initialInstruction, initialReplyMode, initialVoice, model, open, provider, onClose, onSaved }) => {
    const [replyMode, setReplyMode] = useState(initialReplyMode)
    const [instruction, setInstruction] = useState(initialInstruction)
    const [voice, setVoice] = useState(initialVoice)
    const [saving, setSaving] = useState(false)
    const voiceOptions = useMemo(() => speechVoiceOptions(provider, model), [model, provider])
    const supportsInstruction = isBailianQwenSpeechModel(provider, model)
    const selectedMode = SPEECH_REPLY_MODE_META[replyMode]

    const handleSave = useCallback(async () => {
      const speechModel: QQSpeechModel = { instruction, model, provider, replyMode, voice }
      setSaving(true)
      try {
        const settings = await updateQQSpeechModel(speechModel)
        toast.success('已保存语音回复设置')
        onSaved(settings)
        onClose()
      } catch (error) {
        toast.error(getErrorMessage(error, '保存语音回复设置失败'))
      } finally {
        setSaving(false)
      }
    }, [instruction, model, onClose, onSaved, provider, replyMode, voice])

    return (
      <Modal
        cancelButtonProps={{ disabled: saving }}
        cancelText='取消'
        confirmLoading={saving}
        destroyOnHidden
        keyboard={!saving}
        maskClosable={!saving}
        okButtonProps={{ disabled: saving || !voice }}
        okText='保存'
        open={open}
        title='语音回复设置'
        width={620}
        onCancel={onClose}
        onOk={handleSave}
      >
        <Flex className='flex-col gap-5 py-1'>
          <section className='flex flex-col gap-2'>
            <Text className='text-sm' strong>
              什么时候使用语音回复
            </Text>
            <RadioGroup
              aria-label='语音回复方式'
              disabled={saving}
              gap={16}
              horizontal={false}
              options={Object.entries(SPEECH_REPLY_MODE_META).map(([value, option]) => ({
                label: option.label,
                value,
              }))}
              value={replyMode}
              onChange={(value) => {
                if (isQQSpeechReplyMode(value)) setReplyMode(value)
              }}
            />
            <Text className='text-xs' type='secondary'>
              {selectedMode.description}
            </Text>
          </section>

          {supportsInstruction ? (
            <section className='flex flex-col gap-2'>
              <label className='text-sm font-medium text-foreground' htmlFor='qq-speech-instruction'>
                自定义语音指令
              </label>
              <Input
                disabled={saving}
                id='qq-speech-instruction'
                maxLength={500}
                placeholder='说话嗲一点，御姐音'
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
              <Text className='text-xs' type='secondary'>
                指令作用于每次语音合成。回复正文中已有的 [excited]、[laughing] 等 Qwen 标签会按位置生效；文字回复时会隐藏这些控制标签，不会自动插入标签。
              </Text>
            </section>
          ) : null}

          <section className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-foreground' htmlFor='qq-speech-voice'>
              音色
            </label>
            <Select
              disabled={saving}
              filterOption={(input, option) =>
                `${String(option.label)} ${option.value}`.toLowerCase().includes(input.toLowerCase())
              }
              optionRender={(option) => (
                <Flex className='min-w-0 flex-col gap-0.5'>
                  <Text>{option.label}</Text>
                  <Text className='truncate text-xs' type='secondary'>
                    {option.value}
                  </Text>
                </Flex>
              )}
              options={voiceOptions}
              id='qq-speech-voice'
              placeholder='选择音色'
              showSearch
              value={voice}
              onChange={(value) => {
                if (typeof value === 'string') setVoice(value)
              }}
            />
            <Text className='text-xs' type='secondary'>
              音色需与所选语音模型匹配。更多音色见
              {' '}
              <a
                className='text-primary underline-offset-2 hover:underline'
                href='https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-audio-tts-voice-list'
                rel='noreferrer'
                target='_blank'
              >
                百炼音色列表
              </a>
              。
            </Text>
          </section>
        </Flex>
      </Modal>
    )
  }
)

QQSpeechSettingsModal.displayName = 'QQSpeechSettingsModal'

export default QQSpeechSettingsModal
