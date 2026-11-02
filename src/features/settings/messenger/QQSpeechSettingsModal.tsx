'use client'

import { getErrorMessage } from '@pure/utils/error'

import { createStaticStyles, cssVar, RadioGroup, toast } from '@lobehub/ui'
import { Flex, Input, Modal, Select, Text, Tooltip } from '@pure/ui'
import { isBailianQwenSpeechModel, isQQSpeechReplyMode, speechVoiceOptions } from '@pure/const'
import { CircleHelp } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import type { QQSpeechModelReference } from '@pure/types'

import type { QQAdvancedSettings, QQSpeechModel } from './qqApi'
import { updateQQSpeechModel } from './qqApi'

type QQSpeechReplyMode = NonNullable<QQSpeechModelReference['replyMode']>

const styles = createStaticStyles(({ css }) => ({
  // Select exposes the search slot but no search icon prop.
  voiceSearch: css`
    &::before {
      content: '';
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      margin-inline-start: 12px;
      margin-inline-end: 8px;
      background-color: ${cssVar.colorTextDescription};
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='8' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='m21 21-4.35-4.35' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")
        center / contain no-repeat;
    }
  `,
}))

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

const SPEECH_REPLY_MODE_OPTIONS = Object.entries(SPEECH_REPLY_MODE_META).map(([value, option]) => ({
  label: (
    <>
      {option.label}
      {' '}
      <Tooltip title={option.description}>
        <CircleHelp
          aria-label={`${option.label}说明`}
          className='inline-block size-3.5 cursor-help align-middle text-muted-foreground'
        />
      </Tooltip>
    </>
  ),
  value,
}))

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
    const allVoiceOptions = useMemo(() => speechVoiceOptions(provider, model), [model, provider])
    // Temporarily show only the first five voices; keep the complete catalog available for later.
    const voiceOptions = useMemo(() => allVoiceOptions.slice(0, 5), [allVoiceOptions])
    const visibleVoiceValues = useMemo(() => new Set(voiceOptions.map(({ value }) => value)), [voiceOptions])
    const supportsInstruction = isBailianQwenSpeechModel(provider, model)

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
              options={SPEECH_REPLY_MODE_OPTIONS}
              value={replyMode}
              onChange={(value) => {
                if (isQQSpeechReplyMode(value)) setReplyMode(value)
              }}
            />
          </section>

          {supportsInstruction ? (
            <section className='flex flex-col gap-2'>
              <Flex className='items-center gap-1.5'>
                <label className='text-sm font-medium text-foreground' htmlFor='qq-speech-instruction'>
                  自定义语音指令
                </label>
                <Tooltip title='控制方言、情感或角色等效果的指令。'>
                  <CircleHelp
                    aria-label='自定义语音指令说明'
                    className='size-3.5 cursor-help text-muted-foreground'
                  />
                </Tooltip>
              </Flex>
              <Input
                disabled={saving}
                id='qq-speech-instruction'
                maxLength={500}
                placeholder='二十八岁的成熟女性，嗓音偏低，说话干净利落，自信大方，气场很足，带着从容的笑意'
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </section>
          ) : null}

          <section className='flex flex-col gap-2'>
            <Flex className='items-center gap-1.5'>
              <label className='text-sm font-medium text-foreground' htmlFor='qq-speech-voice'>
                音色
              </label>
              <Tooltip
                title={
                  <>
                    音色需与所选语音模型匹配。更多音色见{' '}
                    <a
                      className='text-primary underline-offset-2 hover:underline'
                      href='https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-audio-tts-voice-list'
                      rel='noreferrer'
                      target='_blank'
                    >
                      百炼音色列表
                    </a>
                    。
                  </>
                }
              >
                <CircleHelp aria-label='音色说明' className='size-3.5 cursor-help text-muted-foreground' />
              </Tooltip>
            </Flex>
            <Select
              classNames={{ search: styles.voiceSearch }}
              disabled={saving}
              filterOption={(input, option) =>
                visibleVoiceValues.has(option.value) &&
                `${String(option.label)} ${option.value}`.toLowerCase().includes(input.toLowerCase())
              }
              labelRender={(option) =>
                allVoiceOptions.find(({ value }) => value === option.value)?.label ?? option.label
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
          </section>
        </Flex>
      </Modal>
    )
  }
)

QQSpeechSettingsModal.displayName = 'QQSpeechSettingsModal'

export default QQSpeechSettingsModal
