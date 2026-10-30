'use client'

import { ModelIcon, Text, Flex, Tooltip } from '@pure/ui'
import { QWEN_SPEECH_MODEL } from '@pure/const'
import { getAiModel } from '@pure/model-bank'
import type { ModelAbilities, ModelProviderId } from '@pure/model-bank'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { ChevronDownIcon, CircleHelp } from 'lucide-react'
import * as React from 'react'

import ModelSwitchMenu from '@/features/chat/ModelSwitchMenu'

const styles = createStaticStyles(({ css }) => ({
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  // 与渠道页「绑定助手」Select 同为带边框触发器
  modelTrigger: css`
    cursor: pointer;
    box-sizing: border-box;
    width: 100%;
    max-width: 300px;
    min-height: 32px;
    padding-block: 4px;
    padding-inline: 11px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
}))

export interface MessengerModelSwitchProps {
  disabled?: boolean
  excludedAbilities?: Array<keyof ModelAbilities>
  includeCustomProviders?: boolean
  label?: string
  headerAction?: React.ReactNode
  modelId: string
  onSelect: (provider: string, model: string) => void
  provider: string
  requiredAbility?: keyof ModelAbilities
}

/** 渠道设置页共用的模型切换入口（与 /chat 同一套 ModelSwitchMenu）。 */
export const MessengerModelSwitch = React.memo<MessengerModelSwitchProps>(
  ({
    disabled,
    excludedAbilities,
    headerAction,
    includeCustomProviders,
    label = '对话模型',
    modelId,
    onSelect,
    provider,
    requiredAbility,
  }) => {
    const currentDisplayName =
      getAiModel(provider as ModelProviderId, modelId)?.displayName ??
      (provider === 'bailian' && modelId === QWEN_SPEECH_MODEL ? 'Qwen Audio 3.1 TTS Flash' : modelId)

    return (
      <Flex className='flex-col gap-2'>
        <Flex className='items-center gap-1.5'>
          <Text className='text-[13px]' type='secondary'>
            {label}
          </Text>
          {requiredAbility === 'textToSpeech' ? (
            <Tooltip title='Agent 回复将使用此模型生成语音消息回复'>
              <CircleHelp aria-label='语音模型说明' className='size-3.5 cursor-help text-muted-foreground' />
            </Tooltip>
          ) : null}
          {headerAction}
        </Flex>
        <ModelSwitchMenu
          disabled={disabled}
          excludedAbilities={excludedAbilities}
          includeCustomProviders={includeCustomProviders}
          openOnHover={false}
          placement='bottomLeft'
          requiredAbility={requiredAbility}
          selectedModel={modelId}
          selectedProvider={provider}
          onSelect={onSelect}
        >
          <Flex className={[styles.modelTrigger, 'items-center gap-1.5', disabled && 'pointer-events-none opacity-50']}>
            <ModelIcon model={modelId} size={18} />
            <Text className='min-w-0 flex-1 text-[13px]' ellipsis>
              {currentDisplayName}
            </Text>
            <ChevronDownIcon className={cx(styles.chevron, 'flex-none')} size={14} />
          </Flex>
        </ModelSwitchMenu>
      </Flex>
    )
  }
)

MessengerModelSwitch.displayName = 'MessengerModelSwitch'
