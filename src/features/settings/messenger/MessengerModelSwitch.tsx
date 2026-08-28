'use client'

import { ModelIcon, Text, Flex } from '@pure/ui'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDownIcon } from 'lucide-react'
import { memo } from 'react'

import ModelSwitchMenu from '@/features/chat/ModelSwitchMenu'

const styles = createStaticStyles(({ css }) => ({
  chevron: css`
    flex: none;
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
  allowedProviders?: readonly string[]
  disabled?: boolean
  modelId: string
  onSelect: (provider: string, model: string) => void
  provider: string
}

/** 渠道设置页共用的模型切换入口（与 /chat 同一套 ModelSwitchMenu）。 */
export const MessengerModelSwitch = memo<MessengerModelSwitchProps>(
  ({ allowedProviders, disabled, modelId, onSelect, provider }) => {
    const currentDisplayName = getAiModel(provider as ModelProviderId, modelId)?.displayName ?? modelId

    return (
      <Flex className='flex-col gap-2'>
        <Text type='secondary' style={{ fontSize: 13 }}>
          模型
        </Text>
        <ModelSwitchMenu
          allowedProviders={allowedProviders}
          disabled={disabled}
          openOnHover={false}
          placement='bottomLeft'
          selectedModel={modelId}
          selectedProvider={provider}
          onSelect={onSelect}
        >
          <Flex
            className={[styles.modelTrigger, 'flex-row items-center gap-1.5']}
            style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}
          >
            <ModelIcon model={modelId} size={18} />
            <Text ellipsis style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
              {currentDisplayName}
            </Text>
            <ChevronDownIcon className={styles.chevron} size={14} />
          </Flex>
        </ModelSwitchMenu>
      </Flex>
    )
  }
)

MessengerModelSwitch.displayName = 'MessengerModelSwitch'
